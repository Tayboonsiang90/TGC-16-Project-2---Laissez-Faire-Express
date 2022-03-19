//Useful DB Tools
const { getDB, connect } = require("./MongoUtil.js");
const MONGO_URI = process.env.MONGO_URI;

module.exports = {
    checkCountryRepeat,
};

//This function takes in a submitted country and check if its repeated
//Returns true if not repeated, 
async function checkCountryRepeat(country) {
    console.log(country)
    let document = await getDB().collection("country").findOne({ name: country });
    console.log(document)
    console.log(document ? true : false);
    return document ? true: false;
}
