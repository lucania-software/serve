import { Data, Error } from "@lucania/toolbox/shared";
import createExpressEngine, { Request, Response } from "express";
import { Express as ExpressEngine } from "express-serve-static-core";
import type { Server } from "http";
import type { HandleFunction } from "./Handler.js";
import { Handler, Method } from "./Handler.js";

declare module "express-serve-static-core" {

    interface Request {
        // Added by @lucania/serve. Will contain the IP address of the client making the request.
        realIp?: string;
    }

}

type IdentifiedHandleFunction = HandleFunction & { engineHandlerFunctionId?: number };

type Layer = {
    name: string,
    regexp: RegExp,
    handle: IdentifiedHandleFunction;
    route?: Route;
    forId?: number
};

type Route = {
    stack: Layer[]
};

export class Router {

    private static instance: Router | undefined;

    private _engine: ExpressEngine;
    private _server?: Server;
    private _engineHandlerFunctionId: number;
    private _handlerMapping: Record<number, Handler>;

    private constructor() {
        this._engine = createExpressEngine();
        this._engineHandlerFunctionId = 1;
        this._handlerMapping = {};
        this.setup();
    }

    public setup() {
        this._engine.use((request, response, next) => {
            const xForwardedForHeader = request.headers["x-forwarded-for"];
            Data.assert(
                xForwardedForHeader === undefined || typeof xForwardedForHeader === "string",
                `Received unexpected type for x-forwarded-for header "${typeof xForwardedForHeader}"!`
            );
            request.realIp = xForwardedForHeader || request.socket.remoteAddress;
            if (request.realIp !== undefined) {
                const [firstIp] = request.realIp.split(',');
                request.realIp = firstIp.trim();
            }
            next();
        });
    }

    public registerHandler(handler: Handler) {
        const register = this._getEngineRegistrationFunction(handler.method);
        let handleFunction: IdentifiedHandleFunction = async (request, response, next) => {
            Promise.resolve(handler.handle(request, response, next)).catch((error) => this._handleError(error, request, response));
        };
        handleFunction = handleFunction.bind(handler);
        const id = this._engineHandlerFunctionId++;
        handleFunction.engineHandlerFunctionId = id;
        // @ts-ignore
        handleFunction["injectedName"] = handler.constructor.name;
        register(handler.path, handleFunction);

        const layer = Router._extractLayer(id, this._engine._router);
        Data.assert(layer !== undefined, `Failed to find appropriate layer for handler ID ${id}.`);
        this._handlerMapping[id] = handler;
        const router: Route = this._engine._router;
        const length = router.stack.length;
        for (let i = 0; i <= length; i++) {
            if (i === length) {
                router.stack.push(layer);
                break;
            } else {
                const internalLayer: Layer = router.stack[i];
                if (typeof internalLayer.forId === "number") {
                    const registeredHandler = this._handlerMapping[internalLayer.forId];
                    Data.assert(registeredHandler !== undefined, `Failed to find registered handler for layer (ID "${internalLayer.forId}").`);
                    if (handler.priority < registeredHandler.priority) {
                        router.stack.splice(i, 0, layer);
                        break;
                    }
                }
            }
        }
        return handleFunction.engineHandlerFunctionId;
    }

    public registerHandlers(...handlers: Handler[]) {
        return handlers.map((handler) => this.registerHandler(handler));
    }

    public unregisterHandler(handlerId: number) {
        this._removeEngineRoute(handlerId);
        delete this._handlerMapping[handlerId];
    }

    public unregisterHandlers(...handlerIds: number[]) {
        handlerIds.forEach((handlerId) => this.unregisterHandler(handlerId));
    }

    public async start(port: number, host?: string) {
        return new Promise<void>((resolve) => {
            if (host === undefined) {
                this._server = this._engine.listen(port, resolve);
            } else {
                this._server = this._engine.listen(port, host, resolve);
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

    private _handleError(error: any, request: Request, response: Response) {
        console.error(error);
        if (error instanceof Error.Original) {
            response.end(error.message);
        } else {
            response.end("Unknown error");
        }
    }

    private _getEngineRegistrationFunction(method: Method) {
        switch (method) {
            case Method.GET: return this._engine.get.bind(this._engine);
            case Method.HEAD: return this._engine.head.bind(this._engine);
            case Method.POST: return this._engine.post.bind(this._engine);
            case Method.PUT: return this._engine.put.bind(this._engine);
            case Method.DELETE: return this._engine.delete.bind(this._engine);
            case Method.CONNECT: return this._engine.connect.bind(this._engine);
            case Method.OPTIONS: return this._engine.options.bind(this._engine);
            case Method.TRACE: return this._engine.trace.bind(this._engine);
            case Method.PATCH: return this._engine.patch.bind(this._engine);
            case Method.ALL: return this._engine.all.bind(this._engine);
            case Method.MIDDLEWARE: return this._engine.use.bind(this._engine);
        }
    }

    /**
     * Custom handle functions are inserted into the express application's layer stack within a "bound dispatch" layer that contains
     * bindings for path names. This bound dispatch layer must be found in order to insert and extract handlers dynamically.
     * 
     * @note express app.use handlers are NOT created within a "bound dispatch" layer.
     */
    private static _extractLayer(id: number, route: Route): Layer | undefined {
        let extractedLayer = undefined;
        for (let i = 0; i < route.stack.length; i++) {
            const layer = route.stack[i];
            if (id === layer.handle.engineHandlerFunctionId) {
                [extractedLayer] = route.stack.splice(i, 1);
            } else if (layer.route !== undefined && layer.route.stack.length === 1) {
                const [nestedLayer] = layer.route.stack;
                if (nestedLayer.handle.engineHandlerFunctionId === id) {
                    [extractedLayer] = route.stack.splice(i, 1);
                }
            }
        }
        if (extractedLayer !== undefined) {
            extractedLayer.forId = id;
        }
        return extractedLayer;
    }

    private _removeEngineRoute(id: number, route: Route = this._engine._router) {
        Router._extractLayer(id, route);
        return false;
    }

    public static getInstance(): Router {
        if (Router.instance === undefined) {
            Router.instance = new Router();
        }
        return Router.instance;
    }

    public static debugPrint(route: Route, depth: number = 0) {
        const prefix = "----".repeat(++depth);
        console.debug(`${prefix} ROUTE (${route.stack.length})`);
        for (const layer of route.stack) {
            console.debug(`${prefix}: LAYER (name: ${layer.name}, forId: ${layer.forId})`, layer.regexp);
            console.debug(`${prefix}:`, layer.handle);
            if (layer.route !== undefined) {
                Router.debugPrint(layer.route, depth);
            }
        }
    }
}