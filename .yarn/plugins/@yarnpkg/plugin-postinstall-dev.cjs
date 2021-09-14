/* eslint-disable */
module.exports = {
name: "@yarnpkg/plugin-postinstall-dev",
factory: function (require) {
var plugin;(()=>{"use strict";var e={d:(t,r)=>{for(var o in r)e.o(r,o)&&!e.o(t,o)&&Object.defineProperty(t,o,{enumerable:!0,get:r[o]})},o:(e,t)=>Object.prototype.hasOwnProperty.call(e,t),r:e=>{"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})}},t={};e.r(t),e.d(t,{default:()=>o});const r=require("child_process"),o={hooks:{async afterAllInstalled(e){await new Promise(t=>{const o=(0,r.spawn)("yarn",["run","postinstallDev"],{cwd:e.cwd});o.stdout.pipe(process.stdout),o.stderr.pipe(process.stderr),o.addListener("exit",()=>t())})}}};plugin=t})();
return plugin;
}
};