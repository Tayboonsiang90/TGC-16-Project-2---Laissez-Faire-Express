//Useful DB Tools
const { getDB, connect } = require("./MongoUtil.js");
const MONGO_URI = process.env.MONGO_URI;

module.exports = {
    checkCountry,
    checkPosition,
    checkDate,
};

//Returns true if Valid
async function checkCountry(country) {
    let document = await getDB().collection("country").findOne({ name: country });
    return document ? true: false;
}

async function checkPosition(position) {
    let document = await getDB().collection("position").findOne({ name: position });
    return document ? true : false;
}

function checkDate(date) {
    return date > new Date().getTime() ? true : false;
}
