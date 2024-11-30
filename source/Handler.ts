import { Data } from "@lucania/toolbox/shared";
import type { NextFunction, Request, Response } from "express";
import type { Query, RouteParameters } from "express-serve-static-core";

export enum Method {

    GET,
    HEAD,
    POST,
    PUT,
    DELETE,
    CONNECT,
    OPTIONS,
    TRACE,
    PATCH,
    ALL,
    MIDDLEWARE

}

export enum Priority {
    HIGHEST = 1,
    HIGHER = 2,
    HIGH = 3,
    NORMAL = 4,
    LOW = 5,
    LOWER = 6,
    LOWEST = 7
}

export enum Subpriority {
    HIGHEST = -0.03,
    HIGHER = -0.02,
    HIGH = -0.01,
    LOW = 0.01,
    LOWER = 0.02,
    LOWEST = 0.03
}

export type HandleFunction<
    Path extends string = string,
    RequestBody = any,
    ResponseBody = any,
    RequestQuery extends Query = Query,
    Locals extends Record<string, any> = Record<string, any>,
    Parameters = RouteParameters<Path>
> = (
    request: Request<Parameters, ResponseBody, RequestBody, RequestQuery, Locals>,
    response: Response<RequestBody, Locals>,
    next: NextFunction
) => Promise<void> | void;

export type HandlerOptions<
    Path extends string = string,
    RequestBody = any,
    ResponseBody = any,
    RequestQuery extends Query = Query,
    Locals extends Record<string, any> = Record<string, any>,
    Parameters = RouteParameters<Path>
> = {
    method: Method,
    path: Path,
    priority?: number,
    handle: HandleFunction<Path, RequestBody, ResponseBody, RequestQuery, Locals, Parameters>
};

export class Handler<
    Path extends string = string,
    RequestBody = any,
    ResponseBody = any,
    RequestQuery extends Query = Query,
    Locals extends Record<string, any> = Record<string, any>,
    Parameters = RouteParameters<Path>
> {

    public readonly method: Method;
    public readonly path: Path;
    public readonly priority: number;

    protected _handle: HandleFunction<Path, RequestBody, ResponseBody, RequestQuery, Locals, Parameters>;

    public constructor(options: HandlerOptions<Path, RequestBody, ResponseBody, RequestQuery, Locals, Parameters>) {
        this.method = options.method;
        this.path = options.path;
        this.priority = Data.get(options, "priority", Priority.NORMAL);
        this._handle = options.handle;
    }

    public get handle() {
        return this._handle;
    }

}