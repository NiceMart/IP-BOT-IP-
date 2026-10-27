const sensitiveConfig = require('./sensitive.config.json');

module.exports = {
    brandName: sensitiveConfig.APP_NAME || '',
    brandSlogan: '',
    brandShortName: sensitiveConfig.APP_PACKAGE_NAME || '',
    brandDisplayName: sensitiveConfig.APP_NAME || '',

    qrcodePath: "./branding/qrcode-wish.png",

    logoPath: "./branding/logo.png",

    iconPath: "./branding/logo.png",

    loginBgPath: "./branding/login-bg.png",

    apiBaseUrl: sensitiveConfig.AUTH_SERVER_URL ? sensitiveConfig.AUTH_SERVER_URL + '/api' : '',

    website: "",
    websiteGithub: "",
    websiteGitee: "",
};
