import express from "express";
import { ExpressMiddleware } from "./ExpressMiddleware";
import { Priority, Subpriority } from "./Handler";

export class PublicHandler extends ExpressMiddleware {

    public constructor(publicDirectory: string, priority: number = Priority.NORMAL + Subpriority.HIGHEST) {
        super("*", express.static(publicDirectory), priority);
    }

}