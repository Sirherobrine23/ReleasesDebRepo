// Load Tmp fetch
if (typeof global.fetch === "undefined") global.fetch = (...args) => import("node-fetch").then(mod => mod.default(...args));

// Load fetch
import("node-fetch").then(ESMModule => global.fetch = ESMModule.default).catch(error => {});

// JSON Request
async function Json(...options) {
    const Res = await fetch(...options);
    if (Res.ok) return await Res.json(); else throw {
        Http: `${Res.status} ${Res.statusText}`,
        Body: await Res.text()
    };
}

// Text Request
async function Text(...options) {
    const Res = await fetch(...options);
    if (Res.ok) return await Res.text(); else throw {
        Http: `${Res.status} ${Res.statusText}`,
        Body: await Res.text()
    };
}

// Buffer Request
async function BufferResponse(...options) {
    const Res = await fetch(...options);
    if (Res.ok) return Buffer.from(await Res.arrayBuffer()); else throw {
        Http: `${Res.status} ${Res.statusText}`,
        Body: await Res.text()
    };
}

// Exports
module.exports.Text = Text;
module.exports.Json = Json;
module.exports.Buffer = BufferResponse;