import express from "express";
import { Handler, Method } from "./Handler";

export class PublicHandler extends Handler {

    public constructor(publicDirectory: string) {
        super({ method: Method.GET, path: "*", handle: express.static(publicDirectory) });
    }

}