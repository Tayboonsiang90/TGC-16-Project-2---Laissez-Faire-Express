//Useful DB Tools
const { getDB, connect } = require("./MongoUtil.js");
const MONGO_URI = process.env.MONGO_URI;

module.exports = {
    checkUserEmailRegex,
    checkUserEmailRepeat,
    checkUserPasswordRegex,
    checkUserNameRegex,
    checkUserCountryValid,
    checkUserDateOfBirthValid,
};

//TRUE IS VALID, FALSE IS INVALID

//This function checks if an email is keyed in valid REGEX
//Return true if it is a valid email, return false if it is an invalid email
function checkUserEmailRegex(email) {
    isValid = email.match(/^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);
    return isValid ? true : false;
}
//This function takes in a submitted email and if email already being used
//Returns false if its repeated, true if it is not repeated
async function checkUserEmailRepeat(email) {
    let user = await getDB().collection("user").findOne({ email });
    return user ? false : true;
}
//This function checks if anpassword is keyed in valid REGEX (minimum 6 characterr)
//Return true if it is a valid password, return false if it is an invalid password
function checkUserPasswordRegex(password) {
    isValid = password.length >= 6;
    return isValid ? true : false;
}
//This function checks if a name is keyed in valid REGEX (No special characters and numbers, only 1 space between words, no starting or trailing space)
//Return true if it is a valid name, return false if it is an invalid name
function checkUserNameRegex(name) {
    isValid = name.match(/^[a-zA-Z]+(\s{1}[a-zA-Z]+)*$/);
    return isValid ? true : false;
}
//This function takes in a submitted country and check if its valid
//Returns true if valid, false if not
async function checkUserCountryValid(country) {
    let document = await getDB().collection("country").findOne({ name: country });
    return document ? true : false;
}
//This function takes in a submitted brithday and check if underaged
//Returns true if valid, false if not
function checkUserDateOfBirthValid(dateOfBirth) {
    let today = new Date().getTime();
    let timeElapsed = today - new Date(dateOfBirth).getTime();
    if (timeElapsed > 31556926 * 21 * 1000) {
        return true;
    } else {
        return false;
    }
}
