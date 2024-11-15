import { MODULE_ID } from "./main.js";
import { loadActions, actionCategories } from "./actions.js";
const ECHItems = {};
let actionItems;

export function initConfig() {
    Hooks.on("argonInit", (CoreHUD) => {
        actionItems = loadActions();
        if (game.system.id !== "dc20rpg") return;
        registerItems();
        const ARGON = CoreHUD.ARGON;
        class DC20Tooltip extends ARGON.CORE.Tooltip{
            get classes() {
                return super.classes;
            }
        }

        const isMIDI = game.modules.get("midi-qol")?.active;
        const getMidiFlag = (actionType) => {
            if (!isMIDI || !ui.ARGON._actor) return null;
            const flag = ui.ARGON._actor.getFlag("midi-qol", "actions") ?? {};
            const value = flag[actionType] ?? false;
            const midiAction = value ? 0 : 1;
            return midiAction;
        };

        const getActivationType = (item) => {
            if (!item?.system?.activities) {
                return;
            }
            return Array.from(item.system.activities)[0]?.activation?.type;
        };

        const getActionType = (item) => {
            if (!item?.system?.activities) {
                return;
            }
            return Array.from(item.system.activities)[0]?.actionType;
        };

        const actionTypes = {
            action: ["action"],
            bonus: ["bonus"],
            reaction: ["reaction", "reactiondamage", "reactionmanual"],
            free: ["special"],
        };

        const itemTypes = {
            spell: ["spell"],
            feat: ["feat"],
            technique: ["technique"],
            consumable: ["consumable", "equipment", "loot"],
        };

        const equipItems = {
            "weapon": "TYPES.Item.weapon",
            "consumable": "TYPES.Item.consumable",
        }
        const techniqueTypes = ["Attack", "Defense", "Save"]
        
        const mainBarFeatures = [];
        //if (game.settings.get(MODULE_ID, "showWeaponsItems")) itemTypes.consumable.push("weapon");
        //if (game.settings.get(MODULE_ID, "showClassActions")) mainBarFeatures.push("class");
        
        CoreHUD.DND5E = {
            actionTypes,
            itemTypes,
            mainBarFeatures,
            ECHItems,
        };

        Hooks.callAll("enhanced-combat-hud.dc20prg.initConfig", { actionTypes, itemTypes, ECHItems });

        async function getTooltipDetails(item, type) {
            console.log(type)
            let title, description, itemType, subtitle, costs, range, dt;
            let damageTypes = [];
            let properties = [];
            let materialComponents = "";
            if (["skillCheck", "effect"].includes(type)) {
                properties.push({propertiesLabel: ""});
                return { title, description, subtitle, details: {}, properties, footerText: null };
            }
            if (type == "skill") {
                const page = await fromUuid(CONFIG.DC20RPG.skillsJournalUuid[item]);
                title = page.name;
                description = page.text.content;
            } else if (type == "tradeSkill") {
                const page = await fromUuid(CONFIG.DC20RPG.tradeSkillsJournalUuid[item]);
                title = page.name;
                description = page.text.content;
            } else if (type == "save") {
                title = CONFIG.DC20RPG.attributes[item];
                description = CONFIG.DC20RPG.attributes[item]; //game.i18n.localize(`enhancedcombathud-dc20rpg.abilities.${item}.tooltip`);
            } else if (type == "condition") {
                title = item.name;
                description = item.name;
            } else {
                if (!item || !item.system) return;

                title = item.name;
                description = item.system.description;
                //description = item.system.identified ? item.system.description.value : item.system.description.unidentified ?? item.system.description.value;
                itemType = item.type;
                costs = item.system.costs.resources.actionPoint ? `${item.system.costs.resources.actionPoint}` : "0";
                range = item.system.range.normal ? `${item.system.range.normal}/${item.system.range.max} ${item.system.range.unit}` : "-";
                properties = [];
                dt = item.labels?.damageTypes?.split(", ");
                damageTypes = dt && dt.length ? dt : [];
                materialComponents = "";

                switch (itemType) {
                    case "weapon":
                        subtitle = CONFIG.DC20RPG.weaponTypes[item.system.weaponType];
                        properties.push(CONFIG.DC20RPG.actionTypes[getActionType(item)]);
                        for (let [key, value] of Object.entries(item.system.properties)) {
                           if (value["active"]) {
                            properties.push(value.label);
                           }
                        }
                        break;
                    case "spell":
                        subtitle = `${item.system.magicSchool}`;
                        //properties.push(item.system.duration.value);
                        /*properties.push(CONFIG.DND5E.spellSchools[item.system.school]);
                        
                        properties.push(item.labels.save);*/
                        /*for (let comp of item.labels.components.all) {
                            properties.push(comp.abbr);
                        }
                        if (item.labels.materials) materialComponents = item.labels.materials;*/
                        break;
                    case "consumable":
                        subtitle = CONFIG.DC20RPG.consumableTypes[item.system.consumableType];
                        // properties.push(CONFIG.DND5E.itemActionTypes[getActionType(item)]);
                        break;
                    case "feat":
                        subtitle = item.system.requirements;
                        // properties.push(CONFIG.DND5E.itemActionTypes[getActionType(item)]);
                        break;
                }
            }

            if (description) description = await TextEditor.enrichHTML(description, { async: true });
            let details = [];
            if (costs || range) {
                details = [
                    {
                        label: "enhancedcombathud-dc20rpg.tooltip.costs.name",
                        value: !costs ? "0" : `${costs}`,
                    },
                    {
                        label: "enhancedcombathud-dc20rpg.tooltip.range.name",
                        value: range,
                    },
                ];
            }
            if (item?.labels?.toHit) {
                details.push({
                    label: "enhancedcombathud-dc20rpg.tooltip.toHit.name",
                    value: item.labels.toHit,
                });
            }
            if (item?.labels?.derivedDamage?.length) {
                let dmgString = "";
                item.labels.derivedDamage.forEach((dDmg) => {
                    dmgString += dDmg.formula + " " + getDamageTypeIcon(dDmg.damageType) + " ";
                });
                details.push({
                    label: "enhancedcombathud-dc20rpg.tooltip.damage.name",
                    value: dmgString,
                });
            }

            const tooltipProperties = [];
            if (damageTypes?.length) damageTypes.forEach((d) => tooltipProperties.push({ label: d, primary: true }));
            if (properties?.length) properties.forEach((p) => tooltipProperties.push({ label: p?.label ?? p, secondary: true }));
            return { title, description, subtitle, details, properties: tooltipProperties, footerText: materialComponents };
        }

        function getDamageTypeIcon(damageType) {
            switch (damageType.toLowerCase()) {
                case "acid":
                    return '<i class="fas fa-flask"></i>';
                case "bludgeoning":
                    return '<i class="fas fa-hammer"></i>';
                case "cold":
                    return '<i class="fas fa-snowflake"></i>';
                case "fire":
                    return '<i class="fas fa-fire"></i>';
                case "force":
                    return '<i class="fas fa-hand-sparkles"></i>';
                case "lightning":
                    return '<i class="fas fa-bolt"></i>';
                case "necrotic":
                    return '<i class="fas fa-skull"></i>';
                case "piercing":
                    return '<i class="fas fa-crosshairs"></i>';
                case "poison":
                    return '<i class="fas fa-skull-crossbones"></i>';
                case "psychic":
                    return '<i class="fas fa-brain"></i>';
                case "radiant":
                    return '<i class="fas fa-sun"></i>';
                case "slashing":
                    return '<i class="fas fa-cut"></i>';
                case "thunder":
                    return '<i class="fas fa-bell"></i>';
                case "healing":
                    return '<i class="fas fa-heart"></i>';
                default:
                    return "";
            }
        }

        function getProficiencyIcon(proficiency, type) {
            const letters = ['-', 'N']
            switch(type) {
                case 'skill':
                    return `<div class="icon-circle-border" style="position: relative;
                        display: inline-block;">
                        <i class="fas fa-circle" style="color: transparent;  display: inline-block; border: 2px solid #007bff; /* Border color and thickness */
                        border-radius: 50%;"></i>
                        <span class="icon-letter" style="position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%); position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%); font-size: 0.8em">${letters[proficiency]}</span>
                    </div>&nbsp;
                    `;
                case 'attribute':
                    if (proficiency)
                        return '<i class="fa-solid fa-shield"></i>&nbsp;';
                    else
                        return '<i class="fa-regular fa-shield"></i>&nbsp;';
                break;
            }
            
            
        }

        function condenseItemButtons(items) {
            const condenseClassActions = false; //game.settings.get(MODULE_ID, "condenseClassActions");
            if (!condenseClassActions) return items.map((item) => new DC20ItemButton({ item, inActionPanel: true }));
            const condensedItems = [];
            const barItemsLength = items.length;
            const barItemsMultipleOfTwo = barItemsLength - (barItemsLength % 2);
            let currentSplitButtonItemButton = null;
            for (let i = 0; i < barItemsLength; i++) {
                const isCondensedButton = i < barItemsMultipleOfTwo;
                const item = items[i];
                if (isCondensedButton) {
                    if (currentSplitButtonItemButton) {
                        const button = new DC20ItemButton({ item, inActionPanel: false });
                        condensedItems.push(new ARGON.MAIN.BUTTONS.SplitButton(currentSplitButtonItemButton, button));
                        currentSplitButtonItemButton = null;
                    } else {
                        currentSplitButtonItemButton = new DC20ItemButton({ item, inActionPanel: false });
                    }
                } else {
                    condensedItems.push(new DC20ItemButton({ item, inActionPanel: true }));
                }
            }
            return condensedItems;
        }

        class DC20PortraitPanel extends ARGON.PORTRAIT.PortraitPanel {
            constructor(...args) {
                super(...args);
            }

            get description() {
                const { type, system } = this.actor;
                const actor = this.actor;
                const isNPC = type === "npc";
                const isPC = type === "character";
                if (isNPC) {
                    const creatureType = this.actor.system.details.creatureType;
                    const cr = this.actor.system.details.level;
                    return `Level ${cr} ${creatureType}`;
                } else if (isPC) {
                    const acenstry = this.actor.items.find(el => el.id == this.actor.system.details.ancestry.id).name;
                    const classes = this.actor.items.find(el => el.id == this.actor.system.details.class.id).name
                    return `${this.actor.system.details.level} ${classes} (${acenstry})`;
                } else {
                    return "";
                }
            }
            async _renderInner(data) {
                await super._renderInner(data);
            }

            get isDead() {
                return false; //this.isDying && this.actor.type !== "character";
            }

            get isDying() {
                return false; // this.actor.system.attributes.hp.value <= 0;
            }

            get successes() {
                return false; //this.actor.system.attributes?.death?.success ?? 0;
            }

            get failures() {
                return false; //this.actor.system.attributes?.death?.failure ?? 0;
            }

            async getData() {
                //let super_data = super.getData();
                const data = {
                    actionPoints: {
                        current: this.actor.system.resources.ap.value,
                        max: this.actor.system.resources.ap.max,
                        display: this.actor.system.resources.ap.max ? true : false
                    },
                    staminaPoints: {
                        current: this.actor.system.resources.stamina.value,
                        max: this.actor.system.resources.stamina.max
                    },
                    manaPoints: {
                        current: this.actor.system.resources.mana.value,
                        max: this.actor.system.resources.mana.max
                    },
                    gritPoints: {
                        current: this.actor.system.resources.grit.value,
                        max: this.actor.system.resources.grit.max
                    }
                }
                const merged = Object.assign({}, await super.getData(), data);
                return merged;
            }

            get configurationTemplate() {
                return "modules/enhancedcombathud-dc20rpg/templates/argon-actor-config.hbs";
            }

            async _onDeathSave(event) {
                this.actor.rollDeathSave({});
            }
            get template() {
                return `/modules/${MODULE_ID}/templates/PortraitPanel.hbs`;
            }

            async getStatBlocks() {
                const HPText = game.i18n
                    .localize("dc20rpg.resource.health")
                    .split(" ")
                    .map((word) => word.charAt(0).toUpperCase())
                    .join("");
                const ACText = game.i18n
                    .localize("dc20rpg.defence.physical")
                    .split(" ")
                    .map((word) => word.charAt(0).toUpperCase())
                    .join("");
                const SpellDC = game.i18n
                    .localize("dc20rpg.defence.mystical")
                    .split(" ")
                    .map((word) => word.charAt(0).toUpperCase())
                    .join("");;

                const hpColor = this.actor.system.resources.health.current ? "#6698f3" : "rgb(0 255 170)";
                const tempMax = this.actor.system.resources.health.max;
                const hpMaxColor = tempMax ? (tempMax > 0 ? "rgb(222 91 255)" : "#ffb000") : "rgb(255 255 255)";
                
                return [
                    [
                        {
                            text: `${(this.actor.system.resources.health.value)}`,
                            color: hpColor,
                        },
                        {
                            text: `/`,
                        },
                        {
                            text: `${this.actor.system.resources.health.max}`,
                            color: hpMaxColor,
                        },
                        {
                            text: HPText,
                        },
                    ],
                    [
                        {
                            text: ACText,
                        },
                        {
                            text: `${this.actor.system.defences.physical.value}`,
                            color: "var(--ech-movement-baseMovement-background)",
                        },
                    ],
                    [
                        {
                            text: SpellDC,
                        },
                        {
                            text: `${this.actor.system.defences.mystical.value}`,
                            color: "var(--ech-movement-baseMovement-background)",
                        },
                    ],
                    /*[
                        {
                            text: 'AP',
                        },
                        {
                            text: `${this.actor.system.resources.ap.value}`,
                            color: "var(--ech-movement-baseMovement-background)",
                        },
                    ],
                    [
                        {
                            text: 'GR',
                        },
                        {
                            text: `${this.actor.system.resources.grit.value}`,
                            color: "var(--ech-movement-baseMovement-background)",
                        },
                    ],
                    [
                        {
                            text: 'MN',
                        },
                        {
                            text: `${this.actor.system.resources.mana.value}`,
                            color: "var(--ech-movement-baseMovement-background)",
                        },
                    ],
                    [
                        {
                            text: 'ST',
                        },
                        {
                            text: `${this.actor.system.resources.stamina.value}`,
                            color: "var(--ech-movement-baseMovement-background)",
                        },
                    ],*/
                ];
            }
        }

        class DND5eDrawerButton extends ARGON.DRAWER.DrawerButton {
            constructor(buttons, item, type) {
                super(buttons);
                this.item = item;
                this.type = type;
            }

            get hasTooltip() {
                return true;
            }

            get tooltipOrientation() {
                return TooltipManager.TOOLTIP_DIRECTIONS.RIGHT;
            }

            async getTooltipData() {
                const tooltipData = await getTooltipDetails(this.item, this.type);
                return tooltipData;
            }
        }

        class DC20DrawerPanel extends ARGON.DRAWER.DrawerPanel {
            constructor(...args) {
                super(...args);
            }

            get categories() {
                const abilities = this.actor.system.attributes;
                // TODO implement hidden/show untrained skills
                const hiddenUntrained = 0;
                const skills = Object.fromEntries(
                    Object.entries(this.actor.system.skills)
                      .filter(([_, skill]) => skill.mastery > hiddenUntrained)
                  );
                  let tradeSkills;
                if (this.actor.type == "character") {
                    tradeSkills =Object.fromEntries(
                        Object.entries(this.actor.system.tradeSkills)
                        .filter(([_, skill]) => skill.mastery > hiddenUntrained)
                    );
                } else {
                    tradeSkills = [];
                }
                
                const tools = this.actor.itemTypes.tool;

                const addSign = (value) => {
                    if (value >= 0) return `+${value}`;
                    return value;
                };

                const abilitiesButtons = Object.keys(abilities).map((ability) => {
                    const abilityData = abilities[ability];
                    const details_check = {
                        checkKey: ability,
                        roll: "d20+@attributes."+ability+".check",
                        label: game.i18n.localize(`dc20rpg.attributes.${ability}`) +" Check",
                        type: "attributeCheck"
                    };

                    const details_save = {
                        checkKey: ability,
                        roll: "d20+@attributes."+ability+".save",
                        label: game.i18n.localize(`dc20rpg.attributes.${ability}`) +" Save",
                        type: "attributeSave"
                    };
                    
                    return new DND5eDrawerButton(
                        [
                            {
                                label: getProficiencyIcon(abilityData.saveMastery, 'attribute') + abilityData.label,
                                onClick: (event) => {},
                            },
                            {
                                label: addSign(abilityData.check), // + (abilityData.checkBonus || 0)),
                                onClick: (event) => game.dc20rpg.tools.promptRoll(this.actor, details_check),
                            },
                            {
                                label: addSign(abilityData.save),
                                onClick: (event) => game.dc20rpg.tools.promptRoll(this.actor, details_save),
                            },
                        ],
                        ability,
                        "save",
                    );
                });

                const tradeSkillsButtons = Object.keys(tradeSkills).map((skill) => {
                    const skillData = tradeSkills[skill];
                    const details = {
                        checkKey: skill,
                        roll: "d20+@tradeSkills."+skill+".modifier",
                        label: game.i18n.localize(`dc20rpg.trades.${skill}`) +" Check",
                        type: "skillCheck"
                    };
                    return new DND5eDrawerButton(
                        [
                            {
                                label: getProficiencyIcon(skillData.mastery, 'skill') + skillData.label,
                                onClick: (event) => game.dc20rpg.tools.promptRoll(this.actor, details),
                            },
                            {
                                label: `${addSign(skillData.modifier)}<span style="margin: 0 1rem; filter: brightness(0.8)">(${skillData.modifier})</span>`,
                                style: "display: flex; justify-content: flex-end;",
                            },
                        ],
                        skill,
                        "tradeSkill",
                    );
                });
                const skillsButtons = Object.keys(skills).map((skill) => {
                    const skillData = skills[skill];
                    const details = {
                        checkKey: skill,
                        roll: "d20+@skills."+skill+".modifier",
                        label: game.i18n.localize(`dc20rpg.skills.${skill}`) +" Check",
                        type: "skillCheck"
                    };
                    return new DND5eDrawerButton(
                        [
                            {
                                label: getProficiencyIcon(skillData.mastery, 'skill') + skillData.label,
                                onClick: (event) => game.dc20rpg.tools.promptRoll(this.actor, details),
                            },
                            {
                                label: `${addSign(skillData.modifier)}<span style="margin: 0 1rem; filter: brightness(0.8)">(${skillData.modifier})</span>`,
                                style: "display: flex; justify-content: flex-end;",
                            },
                        ],
                        skill,
                        "skill",
                    );
                });

                const toolButtons = tools.map((tool) => {
                    const details = {
                        checkKey: tool.system.tradeSkillKey,
                        roll: "d20+@tradeSkills."+tool.system.tradeSkillKey+".modifier",
                        label: "Tool " + tool.name, //game.i18n.localize(`dc20rpg.skills.${tool.system.tradeSkillKey}`) +" Check",
                        type: "skillCheck"
                    };
                    return new DND5eDrawerButton(
                        [
                            {
                                label: getProficiencyIcon(this.actor.system.tradeSkills[tool.system.tradeSkillKey].mastery, 'skill') + tool.name,
                                onClick: (event) => game.dc20rpg.tools.promptRoll(this.actor, details),
                            },
                            {
                                label: game.i18n.localize(`dc20rpg.trades.${tool.system.tradeSkillKey}`), //addSign(),
                            },
                        ],
                        tool,
                    );
                });

                return [
                    {
                        gridCols: "5fr 2fr 2fr",
                        captions: [
                            {
                                label: "Abilities",
                                align: "left",
                            },
                            {
                                label: "Check",
                                align: "center",
                            },
                            {
                                label: "Save",
                                align: "center",
                            },
                        ],
                        align: ["left", "center", "center"],
                        buttons: abilitiesButtons,
                    },
                    {
                        gridCols: "7fr 2fr",
                        captions: [
                            {
                                label: "Skills",
                            },
                            {
                                label: "",
                            },
                        ],
                        buttons: skillsButtons,
                    },
                    {
                        gridCols: "7fr 2fr",
                        captions: [
                            {
                                label: "Trade Skills",
                            },
                            {
                                label: '',
                                //onClick: (event) => { alert('asd'); },
                            },
                        ],
                        buttons: tradeSkillsButtons,
                    },
                    {
                        gridCols: "7fr 2fr",
                        captions: [
                            {
                                label: "Tools",
                            },
                            {
                                label: "",
                            },
                        ],
                        buttons: toolButtons,
                    },
                ];
            }

            get title() {
                return `${game.i18n.localize("enhancedcombathud-dc20rpg.hud.saves.name")} / ${game.i18n.localize("enhancedcombathud-dc20rpg.hud.skills.name")} / ${game.i18n.localize("enhancedcombathud-dc20rpg.hud.tools.name")}`;
            }
        }

        class DC20ActionActionPanel extends ARGON.MAIN.ActionPanel {
            constructor(...args) {
                super(...args);
            }

            get label() {
                return "dc20rpg.sheet.nav.core";
            }

            get maxActions() {
                return this.actor?.inCombat ? 1 : null;
            }

            get currentActions() {
                return getMidiFlag("action") ?? (this.isActionUsed ? 0 : 1);
            }

            _onNewRound(combat) {
                this.isActionUsed = false;
                this.updateActionUse();
            }

            async _getButtons() {
                const spellItems = this.actor.items.filter((item) => itemTypes.spell.includes(item.type) /*&& actionTypes.action.includes(getActivationType(item)) && !CoreHUD.DND5E.mainBarFeatures.includes(item.system.type?.value)*/);
                const techniqueItems = this.actor.items.filter((item) => item.type == 'technique');
                //const featItems = this.actor.items.filter((item) => itemTypes.feat.includes(item.type) && actionTypes.action.includes(getActivationType(item)) && !CoreHUD.DND5E.mainBarFeatures.includes(item.system.type?.value));
                //const featItems = this.actor.items.filter((item) => item.type == "technique");
                const featItems = (this.actor.items.filter((item) => item.type == "feature" && !["attack"].includes(item.system.actionType)))
                const consumableItems = this.actor.items.filter((item) => itemTypes.consumable.includes(item.type) && actionTypes.action.includes(getActivationType(item)) && !CoreHUD.DND5E.mainBarFeatures.includes(item.system.type?.value));
                const  maneuverItems = this.actor.items.filter(i => i.type === "technique" && !techniqueTypes.includes(i.system.techniqueOrigin));

                const spellButton = !spellItems.length ? [] : [
                    new DC20ButtonPanelButton({ type: "spell", items: spellItems, color: 0 })].filter((button) => button.hasContents);

                const techniqueButton = !techniqueItems.length ? [] : [
                    new DC20ButtonPanelButton({ type: "technique", items: techniqueItems, color: 0 })].filter((button) => button.hasContents);

                const actionButton = [
                    new DC20ButtonPanelButton({ type: "action", items: actionItems, color: 0 })].filter((button) => button.hasContents);

                const specialActions = Object.values(ECHItems);

                const showSpecialActions = false;// game.settings.get(MODULE_ID, "showSpecialActions");
                const buttons = [];
                if (showSpecialActions) {
                    buttons.push(...[new DC20ItemButton({ item: null, isWeaponSet: true, isPrimary: true }), 
                                     new ARGON.MAIN.BUTTONS.SplitButton(new DC20SpecialActionButton(specialActions[0]),
                                     new DC20SpecialActionButton(specialActions[1])),
                                     ...spellButton,
                                     ...actionButton,
                                     ...techniqueButton,
                                     new DC20ButtonPanelButton({ type: "maneuver", items: maneuverItems, color: 0 }),
                                     new DC20ButtonPanelButton({ type: "feat", items: featItems, color: 0 }),
                                     new ARGON.MAIN.BUTTONS.SplitButton(new DC20SpecialActionButton(specialActions[2]),
                                     new DC20SpecialActionButton(specialActions[3])),
                                     new ARGON.MAIN.BUTTONS.SplitButton(new DC20SpecialActionButton(specialActions[4]),
                                     new DC20SpecialActionButton(specialActions[5])),
                                     new DC20ButtonPanelButton({ type: "consumable", items: consumableItems, color: 0 })]);
                } else {
                    buttons.push(...[new DC20ItemButton({ item: null, isWeaponSet: true, isPrimary: true }),
                                 ...spellButton,
                                 new DC20ButtonPanelButton({ type: "feat", items: featItems, color: 0 }),
                                 ...actionButton,
                                 ...techniqueButton,
                                 new DC20ButtonPanelButton({ type: "maneuver", items: maneuverItems, color: 0 }),
                                 new DC20ButtonPanelButton({ type: "consumable", items: consumableItems, color: 0 })]);
                }

                const barItems = this.actor.items.filter((item) => CoreHUD.DND5E.mainBarFeatures.includes(item.system.type?.value) && actionTypes.action.includes(getActivationType(item)));
                buttons.push(...condenseItemButtons(barItems));

                return buttons.filter((button) => button.hasContents || button.items == undefined || button.items.length);
            }
        }

        class DC20InventoryActionPanel extends ARGON.MAIN.ActionPanel {
            constructor(...args) {
                super(...args);
            }

            get label() {
                return "dc20rpg.sheet.nav.inventory";
            }

            get maxActions() {
                return this.actor?.inCombat ? 1 : null;
            }

            get currentActions() {
                return getMidiFlag("bonus") ?? (this.isActionUsed ? 0 : 1);
            }

            _onNewRound(combat) {
                this.isActionUsed = false;
                this.updateActionUse();
            }

            async _getButtons() {
                const buttons = [];
                for(const type in equipItems) {
                    const items = this.actor.items.filter((item) => item.type == type);
                    const itemsButton = !items.length ? [] : [
                        new DC20ButtonPanelButton({ type: type, items: items, color: 1 })].filter((button) => button.hasContents);
                    buttons.push(...itemsButton);
                }
                return buttons.filter((button) => button.hasContents || button.items == undefined || button.items.length);
            }
        }

        class DC20ConditionActionPanel extends ARGON.MAIN.ActionPanel {
            constructor(...args) {
                super(...args);
            }

            get label() {
                return "dc20rpg.sheet.effects.conditions";
            }

            get maxActions() {
                return this.actor?.inCombat ? 1 : null;
            }

            get currentActions() {
                return getMidiFlag("reaction") ?? (this.isActionUsed ? 0 : 1);
            }

            _onNewRound(combat) {
                this.isActionUsed = false;
                this.updateActionUse();
            }

            async _getButtons() {
                const buttons = [];

                const conditionItems = CONFIG.statusEffects.map(obj => {
                    return { ...obj, type: "condition" };
                });

                const type = "condition";
                const conditionsButton = new DC20ButtonPanelButton({ type: type, items: conditionItems, color: 3 });
                if (conditionsButton.hasContents) buttons.push(conditionsButton);

                const conditionNames = CONFIG.statusEffects.map((item) => {return item.name})

                const effectItems = Array.from(this.actor.effects.filter((item) => !conditionNames.includes(item.name))).map(obj => {
                    return { ...obj, type: "effect" };
                });

                const effectsButton = new DC20ButtonPanelButton({ type: 'effect', items: effectItems, color: 3 });
                if (effectsButton.hasContents) buttons.push(effectsButton);
                
                return buttons;

                //buttons.push(new DND5eEquipmentButton({slot: 1}));
                for (const [type, types] of Object.entries(itemTypes)) {
                    const items = this.actor.items.filter((item) => types.includes(item.type) && actionTypes.reaction.includes(getActivationType(item)) && !CoreHUD.DND5E.mainBarFeatures.includes(item.system.type?.value));
                    if (!items.length) continue;
                    const button = new DC20ButtonPanelButton({ type, items, color: 3 });
                    if (button.hasContents) buttons.push(button);
                }

                const barItems = this.actor.items.filter((item) => CoreHUD.DND5E.mainBarFeatures.includes(item.system.type?.value) && actionTypes.reaction.includes(getActivationType(item)));
                buttons.push(...condenseItemButtons(barItems));

                return buttons;
            }
        }

        class DC20ItemButton extends ARGON.MAIN.BUTTONS.ItemButton {
            constructor(...args) {
                super(...args);
            }

            get activity() {
                if (!this.item?.system?.activities) {
                    return;
                }
                return Array.from(this.item.system.activities)[0];
            }

            get hasTooltip() {
                return true;
            }

            get ranges() {
                const item = this.activity;
                
                const touchRange = item.range.units == "touch" ? canvas?.scene?.grid?.distance : null;
                return {
                    normal: item?.range?.value ?? touchRange,
                    long: item?.range?.long ?? null,
                };
            }

            get targets() {
                const item = this.activity;
                const validTargets = ["creature", "ally", "enemy"];
                if(item) {
                    const actionType = item.actionType;
                    const affects = item.target?.affects ?? {};
                    const targetType = affects.type;
                    if (!item.target?.template?.units && validTargets.includes(targetType)) {
                        return affects.count ?? 1;
                    } else if (actionType === "mwak" || actionType === "rwak") {
                        return affects.count || 1;
                    }
                }
                return null;
            }

            get visible() {
                if (!this._isWeaponSet) return super.visible;
                const isReaction = this.parent instanceof DC20ConditionActionPanel;
                const isMelee = this.activity?.actionType === "mwak";
                if (isReaction && !isMelee) return false;
                if (this._isPrimary) return super.visible;
                if (this.activity?.type?.value === "shield") return false;
                return super.visible;
            }

            async getTooltipData() {
                //return "tooltip line 700";
                const tooltipData = await getTooltipDetails(this.item, this.item.type);
                tooltipData.propertiesLabel = "enhancedcombathud-dc20rpg.tooltip.properties.name";
                return tooltipData;
            }

            async _onLeftClick(event) {
                if (this.item.type == "action") {
                    //game.dc20rpg.tools.promptActionRoll(this.actor,item);
                    console.warn("not implemented YET")
                } else if (["condition", "effect"].includes(this.item.type)) {
                    if (this.actor.statuses.filter((item) => item.id === this.item.id).size) {
                        this.actor.toggleStatusEffect(this.item.id, { active: false });
                        this.element.style.backgroundColor = "";
                        this.element.style.opacity = "0.5";
                    } else {
                        this.actor.toggleStatusEffect(this.item.id, { active: true });
                        this.element.style.backgroundColor = "blue";
                        this.element.style.opacity = "1";
                    }

                 } else {
                    ui.ARGON.interceptNextDialog(event.currentTarget);
                    game.dc20rpg.tools.promptItemRoll(this.actor, this.actor.items.get(this.item.id))
                }
                //game.dc20rpg.tools.promptItemRoll(this.token.actor, this.token.actor.items.get(actionId))
                //const used = await this.item.use({event, legacy: false}, {event});
                /*if (used) {
                    DC20ItemButton.consumeActionEconomy(this.activity);
                }*/
            }

            async _onRightClick(event) {
                this.activity?.sheet?.render(true);
            }

            static consumeActionEconomy(item) {
                const activationType = getActivationType(item);
                let actionType = null;
                for (const [type, types] of Object.entries(actionTypes)) {
                    if (types.includes(activationType)) actionType = type;
                }
                if (!actionType) return;
                if (game.combat?.combatant?.actor !== item.parent) actionType = "reaction";
                if (actionType === "action") {
                    ui.ARGON.components.main[0].isActionUsed = true;
                    ui.ARGON.components.main[0].updateActionUse();
                } else if (actionType === "bonus") {
                    ui.ARGON.components.main[1].isActionUsed = true;
                    ui.ARGON.components.main[1].updateActionUse();
                } else if (actionType === "reaction") {
                    ui.ARGON.components.main[2].isActionUsed = true;
                    ui.ARGON.components.main[2].updateActionUse();
                } else if (actionType === "free") {
                    ui.ARGON.components.main[3].isActionUsed = true;
                    ui.ARGON.components.main[3].updateActionUse();
                } else if (actionType === "legendary") {
                    ui.ARGON.components.main[4].isActionUsed = true;
                }
            }

            async render(...args) {
                await super.render(...args);
                console.warn(this.item)
                if (this.activity) {
                    const weapons = this.actor.items.filter((item) => item.consume?.target === this.activity.id);
                    ui.ARGON.updateItemButtons(weapons);
                }
                if (this.item.type == "condition") {
                    const item = this.actor.statuses.filter((item) => item.id === this.item.id)
                    const backgroundColor = item.size ? "blue" : "";
                    const opacity = item.size ? "1" : "0.5";
                    this.element.style.backgroundColor = backgroundColor;
                    this.element.style.opacity = opacity;
                    
                } else if (this.item.type == "effect") {
                    const backgroundColor = this.actor.effects.find((item) => item.name === this.item.name)?.disabled ? "" : "blue";
                    const opacity = this.actor.effects.find((item) => item.name === this.item.name)?.disabled ? "0.5" : "1";
                    this.element.style.backgroundColor = backgroundColor;
                    this.element.style.opacity = opacity;
                }
            }

            get quantity() {
                if (!this.activity) return null;
                const showQuantityItemTypes = ["consumable"];
                const consumeType = this.activity.consume?.type;
                if (consumeType === "ammo") {
                    const ammoItem = this.actor.items.get(this.activity.consume.target);
                    if (!ammoItem) return null;
                    return Math.floor((ammoItem.quantity ?? 0) / this.activity.consume.amount);
                } else if (consumeType === "attribute") {
                    return Math.floor(getProperty(this.actor, this.activity.consume.target) / this.activity.consume.amount);
                } else if (consumeType === "charges") {
                    const chargesItem = this.actor.items.get(this.activity.consume.target);
                    if (!chargesItem) return null;
                    return Math.floor((chargesItem.uses?.value ?? 0) / this.activity.consume.amount);
                } else if (showQuantityItemTypes.includes(this.activity.type)) {
                    return this.activity.uses?.value ?? this.activity.quantity;
                } else if (this.activity.uses.value !== null && this.activity.uses.per !== null && this.activity.uses.max) {
                    return this.activity.uses.value;
                }
                return null;
            }
        }

        class DC20ButtonPanelButton extends ARGON.MAIN.BUTTONS.ButtonPanelButton {
            constructor({ type, items, color }) {
                super();
                this.type = type;
                this.items = items;
                this.color = color;
                this.itemsWithSpells = [];
                this._spells = this.prePrepareSpells();
                this._techniques = this.prePrepareTechniques();
                this._actions = this.prePrepareActions();
            }

            get hasContents() {
                return this._spells ? !!this._spells.length || !!this.itemsWithSpells.length : !!this.items.length;
            }

            get colorScheme() {
                return this.color;
            }

            get id() {
                return `${this.type}-${this.color}`;
            }

            get label() {
                switch (this.type) {
                    case "spell":
                        return "dc20rpg.sheet.nav.spells";
                    case "feat":
                        return "dc20rpg.sheet.nav.features";
                    case "consumable":
                        return "TYPES.Item.consumable";
                    case "technique":
                        return "dc20rpg.sheet.nav.techniques";
                    case "action":
                        return "Actions";
                    case "weapon":
                        return "Weapons";
                    case "condition":
                        return "Conditions";
                    case "effect":
                        return "Effects";
                    case "maneuver":
                        return "dc20rpg.sheet.maneuvers.known"
                    default:
                        console.warn("There is no Label for "+this.type)
                        return "NONE";

                }
            }

            get icon() {
                switch (this.type) {
                    case "spell":
                        return "modules/enhancedcombathud/icons/spell-book.webp";
                    case "feat":
                        return "modules/enhancedcombathud/icons/mighty-force.webp";
                    case "consumable":
                        return "modules/enhancedcombathud/icons/drink-me.webp";
                    case "technique":
                        return `modules/${MODULE_ID}/assets/ninja-heroic-stance.svg`;
                    case "action":
                        return `modules/${MODULE_ID}/assets/play-button.svg`;
                    case "weapon":
                        return "modules/enhancedcombathud/icons/crossed-swords.webp";
                    case "condition":
                        return "modules/enhancedcombathud/icons/cloak-dagger.webp";
                    case "maneuver":
                        return `modules/${MODULE_ID}/assets/skills.svg`;
                    case "effect":
                        return `modules/${MODULE_ID}/assets/focused-lightning.svg`;
                        
                    default:
                        console.warn("There is no icon for "+this.type);
                }
            }

            get showPreparedOnly() {
                if (this.actor.type !== "character") return false;
                const preparedFlag = this.actor.getFlag(MODULE_ID, "showPrepared");
                if (preparedFlag === "all") return false;
                if (preparedFlag === "preparedOnly") return true;
                const classes = this.actor.items.find(el => el.id == this.actor.system.details.class.id).name;
                const requiresPreparation = ["cleric", "druid", "paladin", "wizard", "artificer"].some((className) => classes.includes(className));
                return requiresPreparation;
            }

            prePrepareActions() {
                let actions = [];
                if (this.type != "action") return;
                for (let actionType of  actionCategories) {
                    const list = actionItems.filter((item) => item.category == actionType);
                    if (list.length) {
                        actions.push({
                            label: actionType,
                            buttons: list.map((item) => new DC20ItemButton({ item })),
                            /*uses: () => {
                                //return { max: 1, value: 1 };
                            },*/
                        });
                    }
                }
                return actions;
            }

            prePrepareTechniques() {
                let techniques = [];
                if (this.type !== "technique") return;
                for (let technique of techniqueTypes) {
                    const cat_list = this.actor.items.filter(i => i.type === "technique" && i.system.techniqueOrigin == technique)
                    .filter((item, index, self) => {
                        // Use a Set to track unique names
                        const seenNames = new Set(self.slice(0, index).map(i => i.name));
                        return !seenNames.has(item.name);
                      });
                    if (cat_list.length) {
                        techniques.push({
                            label: technique,
                            buttons: cat_list.map((item) => new DC20ItemButton({ item })),
                            /*uses: () => {
                                //return { max: 1, value: 1 };
                            },*/
                        });

                    }
                }
                return techniques.filter((technique) => technique.buttons.length);
            }

            prePrepareSpells() {
                if (this.type !== "spell") return;
                const level = this.actor.system.details.level;
                const classItem = this.actor.items.find(el=>el.id == this.actor.system.details.class.id);
                const cantripsKnown = classItem.system.scaling.cantripsKnown.values[level];
                const spellsKnow = classItem.system.scaling.spellsKnown.values[level];

                const magicSchools = CONFIG.DC20RPG.magicSchools;
                const itemsToIgnore = [];
                if (game.modules.get("items-with-spells-5e")?.active) {
                    const IWSAPI = game.modules.get("items-with-spells-5e").api;
                    const actionType = this.items[0].system.activation?.type;
                    const spellItems = this.actor.items.filter((item) => item.flags["items-with-spells-5e"]?.["item-spells"]?.length);
                    for (const item of spellItems) {
                        const spellData = item.flags["items-with-spells-5e"]["item-spells"];
                        const itemsInSpell = spellData.map((spell) => this.actor.items.get(spell.id)).filter((item) => item && getActivationType(item) === actionType);
                        if (!itemsInSpell.length) continue;
                        itemsToIgnore.push(...itemsInSpell);
                        if (!IWSAPI.isUsableItem(item)) continue;
                        this.itemsWithSpells.push({
                            label: item.name,
                            buttons: itemsInSpell.map((item) => new DC20ItemButton({ item })),
                            uses: () => {
                                return { max: item.system.uses?.max, value: item.system.uses?.value };
                            },
                        });
                    }
                    this.items = this.items.filter((item) => !itemsToIgnore.includes(item));
                }
                if (this.showPreparedOnly) {
                    const allowIfNotPrepared = ["atwill", "innate", "pact", "always"];
                    this.items = this.items.filter((item) => {
                        if (allowIfNotPrepared.includes(item.system.preparation.mode)) return true;
                        if (item.system.level == 0) return true;
                        return item.system.preparation.prepared;
                    });
                }
                const spells = [
                    ...this.itemsWithSpells,
                    /*{
                        label: "DND5E.SpellPrepAtWill",
                        buttons: this.items.filter((item) => item.system.preparation.mode === "atwill").map((item) => new DC20ItemButton({ item })),
                        uses: { max: Infinity, value: Infinity },
                    },
                    {
                        label: "DND5E.SpellPrepInnate",
                        buttons: this.items.filter((item) => item.system.preparation.mode === "innate").map((item) => new DC20ItemButton({ item })),
                        uses: { max: Infinity, value: Infinity },
                    },*/
                    {
                        label: "Cantrips",
                        buttons: this.items.filter((item) => item.system.spellType == "cantrip").map((item) => new DC20ItemButton({ item })),
                        uses: { max: cantripsKnown, value: cantripsKnown },//{ max: Infinity, value: Infinity },
                    },
                    /*{
                        label: "DND5E.PactMagic",
                        buttons: this.items.filter((item) => item.system.preparation.mode === "pact").map((item) => new DC20ItemButton({ item })),
                        uses: () => {
                            return this.actor.system.spells.pact;
                        },
                    },*/
                ];
                for (const [magicSchool, label] of Object.entries(magicSchools)) {
                    const magicSchoolSpells = this.items.filter((item) => item.type == "spell" && item.system.magicSchool == magicSchool && item.prepared && item.system.spellType != "cantrip");
                    if (!magicSchool.length || level == 0) continue;
                    spells.push({
                        label,
                        buttons: magicSchoolSpells.map((item) => new DC20ItemButton({ item })),
                        uses: () => {
                            return { max: cantripsKnown, value: cantripsKnown };
                        },
                    });
                }
                return spells.filter((spell) => spell.buttons.length);
            }

            async _getPanel() {
                if (this.type === "spell") {
                    return new ARGON.MAIN.BUTTON_PANELS.ACCORDION.AccordionPanel({ id: this.id, accordionPanelCategories: this._spells.map(({ label, buttons, uses }) => new ARGON.MAIN.BUTTON_PANELS.ACCORDION.AccordionPanelCategory({ label, buttons, uses })) });
                } else if (this.type === "technique") {
                    return new ARGON.MAIN.BUTTON_PANELS.ACCORDION.AccordionPanel({ id: this.id, accordionPanelCategories: this._techniques.map(({ label, buttons, uses }) => new ARGON.MAIN.BUTTON_PANELS.ACCORDION.AccordionPanelCategory({ label, buttons, uses })) });
                } else if (this.type == "action") {
                    return new ARGON.MAIN.BUTTON_PANELS.ACCORDION.AccordionPanel({ id: this.id, accordionPanelCategories: this._actions.map(({ label, buttons, uses }) => new ARGON.MAIN.BUTTON_PANELS.ACCORDION.AccordionPanelCategory({ label, buttons, uses })) });
                }else {
                    return new ARGON.MAIN.BUTTON_PANELS.ButtonPanel({ id: this.id, buttons: this.items.map((item) => new DC20ItemButton({ item })) });
                }
            }
        }

        class DC20SpecialActionButton extends ARGON.MAIN.BUTTONS.ActionButton {
            constructor(specialItem) {
                super();
                const actorItem = this.actor.items.getName(specialItem.name);
                this.actorItem = actorItem;
                this.item =
                    actorItem ??
                    new CONFIG.Item.documentClass(specialItem, {
                        parent: this.actor,
                    });
            }

            get label() {
                return this.item.name;
            }

            get icon() {
                return this.item.img;
            }

            get hasTooltip() {
                return true;
            }

            get activity() {
                if (!this.item?.system?.activities) {
                    return;
                }
                return Array.from(this.item.system.activities)[0];
            }

            async getTooltipData() {
                const tooltipData = await getTooltipDetails(this.item, this.type);
                tooltipData.propertiesLabel = "enhancedcombathud-dc20rpg.tooltip.properties.name";
                return tooltipData;
            }

            async _onLeftClick(event) {
                const useCE = game.modules.get("dfreds-convenient-effects")?.active && game.dfreds.effectInterface.findEffect({ effectName: this.label });
                let success = false;
                if (useCE) {
                    success = true;
                    await game.dfreds.effectInterface.toggleEffect({ effectName: this.label, overlay: false, uuids: [this.actor.uuid] });
                } else {
                    success = this.actorItem ? await this.activity.use({ event }, { event }) : await this.createChatMessage();
                }
                if (success) {
                    DC20ItemButton.consumeActionEconomy(this.item);
                }
            }

            async createChatMessage() {
                return await ChatMessage.create({
                    user: game.user,
                    speaker: {
                        actor: this.actor,
                        token: this.actor.token,
                        alias: this.actor.name,
                    },
                    content: `
                    <div class="dnd5e2 chat-card item-card" data-display-challenge="">

    <section class="card-header description collapsible">

        <header class="summary">
            <img class="gold-icon" src="${this.icon}">
            <div class="name-stacked border">
                <span class="title">${this.label}</span>
                <span class="subtitle">
                    Feature
                </span>
            </div>
            <i class="fas fa-chevron-down fa-fw"></i>
        </header>

        <section class="details collapsible-content card-content">
            <div class="wrapper">
                ${this.item.system.description.value}
            </div>
        </section>
    </section>


</div>
                    `,
                });
            }
        }

        class DC20MovementHud extends ARGON.MovementHud {
            constructor(...args) {
                super(...args);
                this.getMovementMode = game.modules.get("elevation-drag-ruler")?.api?.getMovementMode;
            }

            get visible() {
                return game.combat?.started;
            }

            get movementMode() {
                return this.getMovementMode ? this.getMovementMode(this.token) : "ground";
            }

            get movementMax() {
                if (!this.actor) return 0;
                return this.actor.system.movement[this.movementMode].value / canvas.scene.dimensions.distance;
            }
        }

        class DC20ButtonHud extends ARGON.ButtonHud {
            constructor(...args) {
                super(...args);
            }

            get visible() {
                return !game.combat?.started;
            }

            async _getButtons() {
                return [
                    {
                        label: "LongRest",
                        onClick: (event) => {},
                        icon: "fas fa-bed",
                    },
                    {
                        label: "Regain Points",
                        onClick: (event) => {},
                        icon: "fa-solid fa-rotate",
                    },
                    {
                        label: "Flat Roll",
                        onClick: (event) => {
                            const flat_roll = {
                            checkKey: "flat",
                            roll: "d20",
                            label: game.i18n.localize('dc20rpg.sheet.rollMenu.flat'),
                            type: ""
                        };
                        game.dc20rpg.tools.promptRoll(this.actor, flat_roll)},
                        icon: "fa-solid fa-dice-d20",
                    },
                ];
            }
        }

        class DC20WeaponSets extends ARGON.WeaponSets {
            async getDefaultSets() {
                const sets = await super.getDefaultSets();
                const isTransformed = this.actor.flags?.dnd5e?.isPolymorphed;
                if (this.actor.type !== "npc" && !isTransformed) return sets;
                const actions = this.actor.items.filter((item) => item.type === "weapon" && getActivationType(item) === "action");
                const bonus = this.actor.items.filter((item) => item.type === "weapon" && getActivationType(item) === "bonus");
                return {
                    1: {
                        primary: actions[0]?.uuid ?? null,
                        secondary: bonus[0]?.uuid ?? null,
                    },
                    2: {
                        primary: actions[1]?.uuid ?? null,
                        secondary: bonus[1]?.uuid ?? null,
                    },
                    3: {
                        primary: actions[2]?.uuid ?? null,
                        secondary: bonus[2]?.uuid ?? null,
                    },
                };
            }

            async _getSets() {
                const isTransformed = this.actor.flags?.dnd5e?.isPolymorphed;

                const sets = isTransformed ? await this.getDefaultSets() : foundry.utils.mergeObject(await this.getDefaultSets(), foundry.utils.deepClone(this.actor.getFlag("enhancedcombathud", "weaponSets") || {}));

                for (const [set, slots] of Object.entries(sets)) {
                    slots.primary = slots.primary ? await fromUuid(slots.primary) : null;
                    slots.secondary = slots.secondary ? await fromUuid(slots.secondary) : null;
                }
                return sets;
            }

            async _onSetChange({ sets, active }) {
                const switchEquip = false; //game.settings.get("enhancedcombathud-dc20rpg", "switchEquip");
                if (!switchEquip) return;
                const updates = [];
                const activeSet = sets[active];
                const activeItems = Object.values(activeSet).filter((item) => item);
                const inactiveSets = Object.values(sets).filter((set) => set !== activeSet);
                const inactiveItems = inactiveSets
                    .flatMap((set) => Object.values(set))
                    .filter((item) => item)
                    .filter((item) => !activeItems.includes(item));
                activeItems.forEach((item) => {
                    if (!item.system?.equipped) updates.push({ _id: item.id, "system.equipped": true });
                });
                inactiveItems.forEach((item) => {
                    if (item.system?.equipped) updates.push({ _id: item.id, "system.equipped": false });
                });
                return await this.actor.updateEmbeddedDocuments("Item", updates);
            }
        }

        const enableMacroPanel = game.settings.get(MODULE_ID, "macroPanel");
        const mainPanels = [
            DC20ActionActionPanel,
            DC20InventoryActionPanel,
            DC20ConditionActionPanel];
        if (enableMacroPanel) mainPanels.push(ARGON.PREFAB.MacroPanel);
        mainPanels.push(ARGON.PREFAB.PassTurnPanel);

        CoreHUD.definePortraitPanel(DC20PortraitPanel);
        CoreHUD.defineDrawerPanel(DC20DrawerPanel);
        CoreHUD.defineMainPanels(mainPanels);
        CoreHUD.defineMovementHud(DC20MovementHud);
        CoreHUD.defineButtonHud(DC20ButtonHud);
        CoreHUD.defineWeaponSets(DC20WeaponSets);
        CoreHUD.defineTooltip(DC20Tooltip);
        CoreHUD.defineSupportedActorTypes(["character", "npc"]);
    });
}

function registerItems() {
    ECHItems[game.i18n.localize("enhancedcombathud-dc20rpg.items.disengage.name")] = {
        name: game.i18n.localize("enhancedcombathud-dc20rpg.items.disengage.name"),
        type: "feat",
        img: "modules/enhancedcombathud/icons/journey.webp",
        system: {
            type: {
                value: "",
                subtype: "",
            },
            description: {
                value: game.i18n.localize("enhancedcombathud-dc20rpg.items.disengage.desc"),
                chat: "",
                unidentified: "",
            },
            source: "",
            quantity: 1,
            weight: 0,
            price: 0,
            attuned: false,
            attunement: 0,
            equipped: false,
            rarity: "",
            identified: true,
            activation: {
                type: "action",
                cost: 1,
                condition: "",
            },
            duration: {
                value: 1,
                units: "turn",
            },
            target: {
                value: null,
                width: null,
                units: "",
                type: "self",
            },
            range: {
                value: null,
                long: null,
                units: "",
            },
            consume: {
                type: "",
                target: "",
                amount: null,
            },
            ability: "",
            actionType: "util",
            attackBonus: 0,
            chatFlavor: "",
            critical: null,
            damage: {
                parts: [],
                versatile: "",
            },
            formula: "",
            save: {
                ability: "",
                dc: null,
                scaling: "spell",
            },
        },
        sort: 0,
        flags: {
            core: {
                sourceId: "Item.wyQkeuZkttllAFB1",
            },

            "midi-qol": {
                onUseMacroName: "",
            },
        },
    };
    ECHItems[game.i18n.localize("enhancedcombathud-dc20rpg.items.dodge.name")] = {
        name: game.i18n.localize("enhancedcombathud-dc20rpg.items.dodge.name"),
        type: "feat",
        img: "modules/enhancedcombathud/icons/armor-upgrade.webp",
        system: {
            type: {
                value: "",
                subtype: "",
            },
            description: {
                value: game.i18n.localize("enhancedcombathud-dc20rpg.items.dodge.desc"),
                chat: "",
                unidentified: "",
            },
            source: "",
            quantity: 1,
            weight: 0,
            price: 0,
            attuned: false,
            attunement: 0,
            equipped: false,
            rarity: "",
            identified: true,
            activation: {
                type: "action",
                cost: 1,
                condition: "",
            },
            duration: {
                value: 1,
                units: "round",
            },
            target: {
                value: null,
                width: null,
                units: "",
                type: "self",
            },
            range: {
                value: null,
                long: null,
                units: "",
            },

            consume: {
                type: "",
                target: "",
                amount: null,
            },
            ability: "",
            actionType: "util",
            attackBonus: 0,
            chatFlavor: "",
            critical: null,
            damage: {
                parts: [],
                versatile: "",
            },
            formula: "",
            save: {
                ability: "",
                dc: null,
                scaling: "spell",
            },
            consumableType: "trinket",
        },
        sort: 0,
        flags: {
            "midi-qol": {
                onUseMacroName: "",
            },
        },
    };
    ECHItems[game.i18n.localize("enhancedcombathud-dc20rpg.items.ready.name")] = {
        name: game.i18n.localize("enhancedcombathud-dc20rpg.items.ready.name"),
        type: "feat",
        img: "modules/enhancedcombathud/icons/clockwork.webp",
        system: {
            type: {
                value: "",
                subtype: "",
            },
            description: {
                value: game.i18n.localize("enhancedcombathud-dc20rpg.items.ready.desc"),
                chat: "",
                unidentified: "",
            },
            source: "",
            quantity: 1,
            weight: 0,
            price: 0,
            attuned: false,
            attunement: 0,
            equipped: false,
            rarity: "",
            identified: true,
            activation: {
                type: "action",
                cost: 1,
                condition: "",
            },
            duration: {
                value: null,
                units: "",
            },
            target: {
                value: null,
                width: null,
                units: "",
                type: "self",
            },
            range: {
                value: null,
                long: null,
                units: "",
            },

            consume: {
                type: "",
                target: "",
                amount: null,
            },
            ability: "",
            actionType: "util",
            attackBonus: 0,
            chatFlavor: "",
            critical: null,
            damage: {
                parts: [],
                versatile: "",
            },
            formula: "",
            save: {
                ability: "",
                dc: null,
                scaling: "spell",
            },
            consumableType: "trinket",
        },
        sort: 0,
        flags: {
            "midi-qol": {
                onUseMacroName: "",
            },
        },
    };
    ECHItems[game.i18n.localize("enhancedcombathud-dc20rpg.items.hide.name")] = {
        name: game.i18n.localize("enhancedcombathud-dc20rpg.items.hide.name"),
        type: "feat",
        img: "modules/enhancedcombathud/icons/cloak-dagger.webp",
        system: {
            type: {
                value: "",
                subtype: "",
            },
            description: {
                value: game.i18n.localize("enhancedcombathud-dc20rpg.items.hide.desc"),
                chat: "",
                unidentified: "",
            },
            source: "",
            quantity: 1,
            weight: 0,
            price: 0,
            attuned: false,
            attunement: 0,
            equipped: false,
            rarity: "",
            identified: true,
            activation: {
                type: "action",
                cost: 1,
                condition: "",
            },
            duration: {
                value: null,
                units: "",
            },
            target: {
                value: null,
                width: null,
                units: "",
                type: "self",
            },
            range: {
                value: null,
                long: null,
                units: "",
            },

            consume: {
                type: "",
                target: "",
                amount: null,
            },
            recharge: {
                value: null,
                charged: false,
            },
            ability: "",
            actionType: "util",
            attackBonus: 0,
            chatFlavor: "",
            critical: null,
            damage: {
                parts: [],
                versatile: "",
            },
            formula: "",
            save: {
                ability: "",
                dc: null,
                scaling: "spell",
            },
            consumableType: "trinket",
        },
        sort: 0,
        flags: {
            "midi-qol": {
                onUseMacroName: "",
            },
        },
    };
    ECHItems[game.i18n.localize("enhancedcombathud-dc20rpg.items.dash.name")] = {
        name: game.i18n.localize("enhancedcombathud-dc20rpg.items.dash.name"),
        type: "feat",
        img: "modules/enhancedcombathud/icons/walking-boot.webp",
        system: {
            type: {
                value: "",
                subtype: "",
            },
            description: {
                value: game.i18n.localize("enhancedcombathud-dc20rpg.items.dash.desc"),
                chat: "",
                unidentified: "",
            },
            source: "",
            quantity: 1,
            weight: 0,
            price: 0,
            attuned: false,
            attunement: 0,
            equipped: false,
            rarity: "",
            identified: true,
            activation: {
                type: "action",
                cost: 1,
                condition: "",
            },
            duration: {
                value: null,
                units: "",
            },
            target: {
                value: null,
                width: null,
                units: "",
                type: "self",
            },
            range: {
                value: null,
                long: null,
                units: "",
            },

            consume: {
                type: "",
                target: "",
                amount: null,
            },
            ability: "",
            actionType: "util",
            attackBonus: 0,
            chatFlavor: "",
            critical: null,
            damage: {
                parts: [],
                versatile: "",
            },
            formula: "",
            save: {
                ability: "",
                dc: null,
                scaling: "spell",
            },
            consumableType: "trinket",
        },
        sort: 0,
        flags: {
            "midi-qol": {
                onUseMacroName: "",
            },
        },
    };
    ECHItems[game.i18n.localize("enhancedcombathud-dc20rpg.items.shove.name")] = {
        name: game.i18n.localize("enhancedcombathud-dc20rpg.items.shove.name"),
        type: "feat",
        img: "modules/enhancedcombathud/icons/shield-bash.webp",
        system: {
            type: {
                value: "",
                subtype: "",
            },
            description: {
                value: game.i18n.localize("enhancedcombathud-dc20rpg.items.shove.desc"),
                chat: "",
                unidentified: "",
            },
            source: "",
            quantity: 1,
            weight: 0,
            price: 0,
            attuned: false,
            attunement: 0,
            equipped: false,
            rarity: "",
            identified: true,
            activation: {
                type: "action",
                cost: 1,
                condition: "",
            },
            duration: {
                value: null,
                units: "",
            },
            target: {
                value: 1,
                width: null,
                units: "",
                type: "creature",
            },
            range: {
                value: null,
                long: null,
                units: "touch",
            },

            consume: {
                type: "",
                target: "",
                amount: null,
            },
            ability: "",
            actionType: "util",
            attackBonus: 0,
            chatFlavor: "",
            critical: null,
            damage: {
                parts: [],
                versatile: "",
            },
            formula: "",
            save: {
                ability: "",
                dc: null,
                scaling: "spell",
            },
            consumableType: "trinket",
        },
        sort: 0,
        flags: {
            "midi-qol": {
                onUseMacroName: "",
            },
        },
    };
}

