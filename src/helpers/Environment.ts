import fs from "fs";
import path from "path";

import { EnvironmentBase } from "../apiBase";

export class Environment extends EnvironmentBase {
  static googleRecaptchaSecretKey: string;
  static membershipApi: string;

  static init(environment: string) {
    let file = "dev.json";
    if (environment === "staging") file = "staging.json";
    if (environment === "prod") file = "prod.json";


    const relativePath = "../../config/" + file;
    const physicalPath = path.resolve(__dirname, relativePath);

    const json = fs.readFileSync(physicalPath, "utf8");
    const data = JSON.parse(json);
    this.populateBase(data);
    this.membershipApi = data.membershipApi;

    Environment.googleRecaptchaSecretKey = process.env.GOOGLE_RECAPTCHA_SECRET_KEY;
  }

}