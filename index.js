//Express setup
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
app.use(express.json());
app.use(cors());

//Useful DB Tools
const { ObjectId } = require("mongodb").ObjectId;
const { getDB, connect } = require("./MongoUtil.js");
const MONGO_URI = process.env.MONGO_URI;

//Collection Names
const USER = "user";
const COUNTRY = "country";
const BALANCES = "balances";
const ORDER_HISTORY = "orderHistory";
const DEPOSIT_TRANSACTIONS = "depositTransactions";
const WITHDRAWAL_TRANSACTIONS = "withdrawalTransactions";
const OPEN_PREDICTION_MARKETS = "openPredictionMarkets";
const RESOLVING_PREDICTION_MARKETS = "resolvingPredictionMarkets";
const CLOSED_PREDICTION_MARKETS = "closedPredictionMarkets";
const STAFF = "staff";

//helper functions
const user = require("./user.js");
const country = require("./country.js");

// Routes
async function main() {
    await connect(MONGO_URI, "LaissezFaire");

    //Sanity Checker
    app.get("/welcome", function (req, res) {
        res.json({
            message: "Welcome to the Laissez Faire api! It is working.",
        });
    });

    //Input: Email Password Name Country Date of Birth
    //Processing: Validates email, password, name, country, date of birth
    app.post("/signup", async function (req, res) {
        console.log("Signup in progress");
        //Backend Validation
        let { email, password, name, country, dateOfBirth } = req.body;
        try {
            if (!user.checkUserEmailRegex(email)) {
                throw "Email is not valid. Please try again.";
            }
            if (!(await user.checkUserEmailRepeat(email))) {
                throw "Email is already taken. Please try again.";
            }
            if (!user.checkUserPasswordRegex(password)) {
                throw "Password is not complex enough. Please try again with a different password.";
            }
            if (!user.checkUserNameRegex(name)) {
                throw "Name is not valid. Please try again.";
            }
            if (!(await user.checkUserCountryValid(country))) {
                throw "Your country is not in the list of allowed regions.";
            }
            if (!user.checkUserDateOfBirthValid(dateOfBirth)) {
                throw "Your age must be above 21 to trade on this exchange.";
            }

            //Insert document after validation
            await getDB()
                .collection(USER)
                .insertOne({
                    email: email,
                    password: password,
                    name: name,
                    country: country,
                    dateOfBirth: new Date(dateOfBirth),
                });
            res.status(200);
            res.json({
                message: "Signup is successful",
            });
        } catch (e) {
            res.status(500);
            res.json({
                message: e,
            });
        }
    });

    // app.post("/country_initial", async function (req, res) {
    //     console.log("Add country in progress");
    //     let countryInput = req.body.country;

    //     for (let i of countryInput.split(",")) {
    //         getDB().collection(COUNTRY).insertOne({ name: i.trim() });
    //     }

    //     res.status(200);
    //     res.json({
    //         message: "The record has been added successfully",
    //     });
    // });

    app.post("/country", async function (req, res) {
        console.log("Add country in progress");
        let countryInput = req.body.country;

        try {
            if (await country.checkCountryRepeat(countryInput)) {
                throw "Country is already in the database.";
            }
            await getDB().collection(COUNTRY).insertOne({ name: countryInput });

            res.status(200);
            res.json({
                message: "The country has been added successfully",
            });
        } catch (e) {
            res.status(500);
            res.json({
                message: e,
            });
        }
    });

    app.delete("/country", async function (req, res) {
        console.log("Delete country in progress");
        let countryInput = req.body.country;

        try {
            console.log(countryInput);
            await getDB().collection(COUNTRY).deleteOne({ name: countryInput });

            res.status(200);
            res.json({
                message: "The country has been deleted successfully",
            });
        } catch (e) {
            res.status(500);
            res.json({
                message: e,
            });
        }
    });

    //Return a list of countries in database, {countryArray:[country1, country2]}
    app.get("/country", async function (req, res) {
        let countryList = await getDB().collection(COUNTRY).find().project({ _id: 0 }).toArray();
        let countryArray = [];
        for (let item of countryList) {
            countryArray.push(item.name);
        }

        res.status(200);
        res.json({ countryArray });
    });

    // app.post("/free_food_sighting", async function (req, res) {
    //     try {
    //         let description = req.body.description;
    //         let food = req.body.food.split(",");
    //         let datetime = new Date(req.body.datetime);

    //         const db = getDB();
    //         // db.collection('food_sightings').insertOne({
    //         //     'description':description,
    //         //     'food':food,
    //         //     'date':datetime
    //         // })

    //         await db.collection(COLLECTION_NAME).insertOne({
    //             description,
    //             food,
    //             datetime,
    //         });
    //         res.status(200);
    //         res.json({
    //             message: "The record has been added successfully",
    //         });
    //     } catch (e) {
    //         res.status(500);
    //         res.json({
    //             message: "Internal server error. Please contact administrator",
    //         });
    //         console.log(e);
    //     }
    // });

    // app.get("/free_food_sighting", async function (req, res) {
    //     // create citeria object (assumption: the user wants everything)
    //     let criteria = {};

    //     if (req.query.description) {
    //         criteria["description"] = {
    //             $regex: req.query.description,
    //             $options: "i",
    //         };
    //     }

    //     if (req.query.food) {
    //         criteria["food"] = {
    //             $in: [req.query.food],
    //         };
    //     }

    //     const db = getDB();
    //     let foodSightings = await db.collection(COLLECTION_NAME).find(criteria).toArray();
    //     res.json({
    //         food_sightings: foodSightings,
    //     });
    // });

    // app.put("/free_food_sighting/:id", async function (req, res) {
    //     let { description, food, datetime } = req.body;
    //     /*
    //         let description = req.body.description;
    //         let food = req.body.food;
    //         let datetime = req.body.datetime
    //     */
    //     food = food.split(",");

    //     // remove all whitespaces from the front and back
    //     food = food.map(function (each_food_item) {
    //         return each_food_item.trim();
    //     });
    //     datetime = new Date(datetime);
    //     let results = await getDB()
    //         .collection(COLLECTION_NAME)
    //         .updateOne(
    //             {
    //                 _id: ObjectId(req.params.id),
    //             },
    //             {
    //                 $set: {
    //                     description: description,
    //                     food: food,
    //                     datetime: datetime,
    //                 },
    //             }
    //         );
    //     res.status(200);
    //     res.json({
    //         message: "Food sighting has been updated",
    //     });
    // });

    // app.delete("/free_food_sighting/:id", async function (req, res) {
    //     await getDB()
    //         .collection(COLLECTION_NAME)
    //         .deleteOne({
    //             _id: ObjectId(req.params.id),
    //         });
    //     res.status(200);
    //     res.json({
    //         message: "The document has been deleted",
    //     });
    // });
}

main();

//Use Home VSC http://127.0.0.1:8888/welcome
// Listen (must be the last)
app.listen(process.env.PORT, function () {
    console.log("Server has started");
});
