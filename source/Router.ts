import { Data, Error } from "@lucania/toolbox/shared";

import type { Server } from "http";

import type { Express, NextFunction, Request, Response } from "express-serve-static-core";
import express from "express";

export enum Priority {
    HIGHEST = -3,
    HIGHER = -2,
    HIGH = -1,
    NORMAL = 0,
    LOW = 1,
    LOWER = 2,
    LOWEST = 3
}

export enum Subpriority {
    HIGHEST = -0.03,
    HIGHER = -0.02,
    HIGH = -0.01,
    LOW = 0.01,
    LOWER = 0.02,
    LOWEST = 0.03
}

export type HandlerRegistrationOptions = {
    priority: number,
    scope?: string
};

export type RegistrationCallback = (engine: Express) => void;

type HandlerRegistration = { id: number, priority: number, register: RegistrationCallback };

export class Router {

    private _registrations = new Map<number, HandlerRegistration>;
    private _scopes = new Map<string, number[]>;
    private _nextHandlerId = 0;
    private _engine: Express | undefined = undefined;
    private _server: Server | undefined = undefined;

    public register(options: HandlerRegistrationOptions, register: RegistrationCallback) {
        const id = this._getNextHandlerId();
        const handlerRegistration = { id, priority: options.priority, register };
        this._registrations.set(id, handlerRegistration);
        if (options.scope !== undefined) {
            const scopes = this._scopes.get(options.scope);
            if (scopes === undefined) {
                this._scopes.set(options.scope, [id]);
            } else {
                scopes.push(id);
            }
        }
        return handlerRegistration;
    }

    public unregister(id: number): void;
    public unregister(scope: string): void;
    public unregister(idOrScope: number | string) {
        if (typeof idOrScope === "number") {
            this._registrations.delete(idOrScope);
            this._cleanScopes(idOrScope);
        } else if (typeof idOrScope === "string") {
            const unregisteredIds = this._scopes.get(idOrScope);
            if (unregisteredIds !== undefined) {
                this._scopes.delete(idOrScope);
                for (const unregisteredId of unregisteredIds) {
                    this._registrations.delete(unregisteredId);
                }
            }
        } else {
            throw new Error.Fatal("Invalid parameter.");
        }
    }

    public update() {
        this._engine = this._setupAsyncErrorHandling(express());
        const registrations = [...this._registrations.values()].sort((a, b) => a.priority - b.priority);
        for (const registration of registrations) {
            registration.register(this._engine);
        }
        return this._engine;
    }

    public async start(port: number, host?: string) {
        return new Promise<void>((resolve) => {
            const engine = this._engine === undefined ? this.update() : this._engine;
            if (host === undefined) {
                this._server = engine.listen(port, resolve);
            } else {
                this._server = engine.listen(port, host, resolve);
            }
        });
    }

    public async stop() {
        return new Promise<void>((resolve, reject) => {
            Data.assert(this._server !== undefined, "Attempted to stop router before it was started.");
            this._server.close((error) => error === undefined ? resolve() : reject(error));
        });
    }

    public get server() {
        return this._server;
    }

    public get engine() {
        return this._engine;
    }

    private _setupAsyncErrorHandling(engine: Express) {
        const functionNames: (keyof Express)[] = ["get", "head", "post", "put", "delete", "all", "use"];
        for (const functionName of functionNames) {
            const method = engine[functionName];
            if (typeof method === "function") {
                engine[functionName] = function (...parameters: any[]) {
                    const newParameters = parameters.map((parameter) => {
                        if (typeof parameter === "function") {
                            return parameter.length === 4 ? (
                                (error: any, request: Request, response: Response, next: NextFunction) => {
                                    return Promise.resolve(parameter(error, request, response, next)).catch(next);
                                }
                            ) : (
                                (request: Request, response: Response, next: NextFunction) => {
                                    return Promise.resolve(parameter(request, response, next)).catch(next);
                                }
                            );
                        }
                        return parameter;
                    });
                    return method.call(this, ...newParameters);
                }
            }
        }
        return engine;
    }

    private _cleanScopes(invalidatedId: number) {
        for (const scope in this._scopes.keys()) {
            const ids = this._scopes.get(scope);
            Data.assert(ids !== undefined);
            const newIds = ids.filter((id) => id !== invalidatedId);
            if (newIds.length <= 0) {
                this._scopes.delete(scope);
            } else {
                this._scopes.set(scope, newIds);
            }
        }
    }

    private _getNextHandlerId() {
        return this._nextHandlerId++;
    }

}