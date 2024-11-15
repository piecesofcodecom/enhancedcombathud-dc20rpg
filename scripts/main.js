import {initConfig} from "./config.js";
import { registerSettings } from "./settings.js";

export const MODULE_ID = "enhancedcombathud-dc20rpg";

Hooks.on("setup", () => {
    registerSettings();
    initConfig();
});

Hooks.once('init', async function() {
    registerHandlebars()
});

function registerHandlebars() {

    Handlebars.registerHelper({
        eq: (v1, v2) => v1 === v2,
        ne: (v1, v2) => v1 !== v2,
        lt: (v1, v2) => v1 < v2,
        gt: (v1, v2) => v1 > v2,
        lte: (v1, v2) => v1 <= v2,
        gte: (v1, v2) => v1 >= v2,
        and() {
            console.log("ASDASDASDSADASDASD")
            return Array.prototype.every.call(arguments, Boolean);
        },
        or() {
            console.log("ASDASDASDSADASDASD")
            return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
        }
    });
}
