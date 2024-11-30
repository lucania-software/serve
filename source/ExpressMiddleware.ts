import { Handler, Method, Priority } from "./Handler";
import type { Query, RouteParameters, RequestHandler } from "express-serve-static-core";

export class ExpressMiddleware<
    Path extends string = string,
    RequestBody = any,
    ResponseBody = any,
    RequestQuery extends Query = Query,
    Locals extends Record<string, any> = Record<string, any>,
    Parameters = RouteParameters<Path>
> extends Handler<Path, RequestBody, ResponseBody, RequestQuery, Locals, Parameters> {

    public constructor(path: Path, middleware: RequestHandler<
        Parameters,
        ResponseBody,
        RequestBody,
        RequestQuery,
        Locals
    >, priority: Priority = Priority.HIGHER) {
        super({
            method: Method.MIDDLEWARE, path, priority, handle: middleware as any
        });
    }

}