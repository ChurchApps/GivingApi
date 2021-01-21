import { controller, httpPost } from "inversify-express-utils";
import { Fund } from "../models";
import { UserInterface, ChurchInterface } from "../helpers";
import express from "express";
import { GivingBaseController } from "./GivingBaseController";

@controller("/churches")
export class ChurchController extends GivingBaseController {

    async validateInit(churchId: number) {
        const errors = [];
        const funds = await this.repositories.fund.loadAll(churchId);
        if (funds.length > 0) errors.push("Church already initialized");
        return errors;
    }

    @httpPost("/init")
    public async init(req: express.Request<{}, {}, { user: UserInterface, church: ChurchInterface }>, res: express.Response): Promise<any> {
        return this.actionWrapper(req, res, async (au) => {
            const errors = await this.validateInit(au.churchId);
            if (errors.length > 0) return this.denyAccess(errors);
            else {
                const fund: Fund = { churchId: au.churchId, name: "General Fund" }
                await this.repositories.fund.save(fund);
                return {};
            }

        });
    }


}


