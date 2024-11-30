import { Data, Error } from "@lucania/toolbox/shared";
import type { ParamsDictionary, Query, RouteParameters } from "express-serve-static-core";
import type { HandlerOptions } from "./Handler";
import { Handler } from "./Handler";
import { RateLimiterMemory } from "rate-limiter-flexible";

export type EndpointOptions<
    Path extends string = string,
    RequestBody = any,
    ResponseBody = any,
    RequestQuery extends Query = Query,
    Locals extends Record<string, any> = Record<string, any>,
    Parameters extends ParamsDictionary = RouteParameters<Path>
> = (
        HandlerOptions<Path, RequestBody, ResponseBody, RequestQuery, Locals, Parameters> & {
            rateLimits?: {
                points: number;
                duration: number;
                blockDuration?: number;
            }
        }
    );

export class Endpoint<
    Path extends string = string,
    RequestBody = any,
    ResponseBody = any,
    RequestQuery extends Query = Query,
    Locals extends Record<string, any> = Record<string, any>,
    Parameters extends ParamsDictionary = RouteParameters<Path>
> extends Handler<
    Path,
    RequestBody,
    ResponseBody,
    RequestQuery,
    Locals,
    Parameters
> {

    private _rateLimiter: RateLimiterMemory;

    public constructor(options: EndpointOptions<Path, RequestBody, ResponseBody, RequestQuery, Locals, Parameters>) {
        super({
            ...options, handle: async (request, response, next) => {
                Data.assert(request.realIp !== undefined, `The back-end was unable to determine your IP address.`);
                try {
                    await this._rateLimiter.consume(request.realIp);
                } catch (error) {
                    throw new Error.TooManyRequests("You have made too many requests in too short of a time.");
                }
                await options.handle(request, response, next);
            }
        });
        this._rateLimiter = new RateLimiterMemory(Data.get(options, "rateLimits", { points: 100, duration: 60, blockDuration: 10 }));
    }

}