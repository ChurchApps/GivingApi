import { controller, httpPost } from "inversify-express-utils";
import { Fund } from "../models";
import { UserInterface, ChurchInterface } from "../helpers";
import express from "express";
import { GivingBaseController } from "./GivingBaseController";

@controller("/churches")
export class ChurchController extends GivingBaseController {

    @httpPost("/init")
    public async init(req: express.Request<{}, {}, { user: UserInterface, church: ChurchInterface }>, res: express.Response): Promise<any> {
        return this.actionWrapper(req, res, async (au) => {
            const funds = await this.repositories.fund.loadAll(au.churchId);
            if (funds.length === 0) {
                const fund: Fund = { churchId: au.churchId, name: "General Fund" }
                await this.repositories.fund.save(fund);

            }
            return {};
        });
    }
}


