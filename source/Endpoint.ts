import type { Query, RouteParameters } from "express-serve-static-core";
import type { HandlerOptions } from "./Handler";
import { Handler } from "./Handler";

export type EndpointOptions<
    Path extends string = string,
    RequestBody = any,
    ResponseBody = any,
    RequestQuery extends Query = Query,
    Locals extends Record<string, any> = Record<string, any>,
    Parameters = RouteParameters<Path>
> = HandlerOptions<Path, RequestBody, ResponseBody, RequestQuery, Locals, Parameters> & {

};

export class Endpoint<
    Path extends string = string,
    RequestBody = any,
    ResponseBody = any,
    RequestQuery extends Query = Query,
    Locals extends Record<string, any> = Record<string, any>,
    Parameters = RouteParameters<Path>
> extends Handler<
    Path,
    RequestBody,
    ResponseBody,
    RequestQuery,
    Locals,
    Parameters
> {

    public constructor(options: EndpointOptions<Path, RequestBody, ResponseBody, RequestQuery, Locals, Parameters>) {
        super(options);
    }

}