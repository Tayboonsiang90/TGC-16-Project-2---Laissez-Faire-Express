//Useful DB Tools
const { getDB, connect } = require("./MongoUtil.js");
const MONGO_URI = process.env.MONGO_URI;

module.exports = {
    checkNumberRegex,
};

//This function takes checked is a transaction number is indeed a number, can have decimals
function checkNumberRegex(num) {
    isValid = num.toString().match(/^\d*\.?\d*$/);
    return isValid ? true : false;
}
