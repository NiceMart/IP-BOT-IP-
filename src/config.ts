/* Modified for IP Bot: publication preparation, configuration or security changes. See CHANGELOG.md. */
import packageJson from "../package.json";
declare const __IPBOT_PUBLIC_CONFIG__: { APP_NAME: string; AUTH_SERVER_URL: string };
const sensitiveConfig = typeof __IPBOT_PUBLIC_CONFIG__ !== "undefined" ? __IPBOT_PUBLIC_CONFIG__ : { APP_NAME: "IP Bot", AUTH_SERVER_URL: "http://127.0.0.1:3002" };

const BASE_URL = "";

export const AppConfig = {
    name: sensitiveConfig.APP_NAME,
    title: sensitiveConfig.APP_NAME,
    slogan: "",
    version: packageJson.version,
    website: ``,
    websiteGithub: "",
    websiteGitee: "",
    apiBaseUrl: `${sensitiveConfig.AUTH_SERVER_URL}/api`,
    updaterUrl: ``,
    downloadUrl: ``,
    feedbackUrl: ``,
    statisticsUrl: ``,
    guideUrl: ``,
    helpUrl: ``,
    serverUrl: ``,
    basic: {
        userEnable: false,
    },
};
