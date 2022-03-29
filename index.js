//Express setup
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
app.use(express.json());
app.use(cors());

//Useful DB Tools
const { ObjectId } = require("mongodb");
const { getDB, connect } = require("./MongoUtil.js");
const MONGO_URI = process.env.MONGO_URI;

//Collection Names
const USER = "user";
const COUNTRY = "country";
const BALANCES = "balances";
const ORDER_HISTORY = "orderHistory";
const TRANSACTIONS = "transactions";
const OPEN_PREDICTION_MARKETS = "openPredictionMarkets";
const RESOLVING_PREDICTION_MARKETS = "resolvingPredictionMarkets";
const CLOSED_PREDICTION_MARKETS = "closedPredictionMarkets";
const STAFF = "staff";

//helper functions
const user = require("./user.js");
const country = require("./country.js");
const transactions = require("./transactions.js");
const trade = require("./trade.js");

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
        let { email, password, name, country, dateOfBirth } = req.body;
        //Backend Validation
        try {
            if (!user.checkUserEmailRegex(email)) {
                throw "Email is not valid. Please try again.";
            }
            if (!(await user.checkUserEmailRepeat(email))) {
                throw "Email is already taken. Please try again.";
            }
            if (!user.checkUserPasswordRegex(password)) {
                throw "Password is not complex enough. It needs to be 6 characters min with at least 1 letter, 1 number and 1 special character";
            }
            if (!user.checkUserNameRegex(name)) {
                throw "Name is not valid. Please try again.";
            }
            if (!user.checkUserDateOfBirthValid(dateOfBirth)) {
                throw "Your age must be above 21 to trade on this exchange.";
            }
            if (!(await user.checkUserCountryValid(country))) {
                throw "Your country is not in the list of allowed regions.";
            }

            //Insert document after validation
            await getDB()
                .collection(USER)
                .insertOne({
                    email: email,
                    password: password,
                    name: name,
                    country: country,
                    dateOfBirth: new Date(dateOfBirth).getTime(),
                    timestamp: new Date().getTime(),
                    USD: 1000,
                    totalDeposited: 1000,
                    totalWithdrew: 0,
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

    app.post("/deposit", async function (req, res) {
        try {
            let _id = req.body._id;
            let quantity = Number(req.body.quantity);
            //Backend Validation
            if (!transactions.checkNumberRegex(quantity)) {
                throw "The quantity supplied is an invalid value.";
            }
            //Modify user USD
            await getDB()
                .collection(USER)
                .updateOne(
                    {
                        _id: ObjectId(_id),
                    },
                    {
                        $inc: { USD: quantity, totalDeposited: quantity },
                    }
                );
            //Insert transaction document
            await getDB()
                .collection(TRANSACTIONS)
                .insertOne({
                    user_id: ObjectId(_id),
                    quantity: quantity,
                    type: "DEPOSIT",
                    timestamp: new Date().getTime(),
                });
            res.status(200);
            res.json({
                message: "Deposit success.",
            });
        } catch (e) {
            res.status(500);
            res.json({
                message: e,
            });
        }
    });

    app.post("/withdraw", async function (req, res) {
        try {
            let _id = req.body._id;
            let quantity = Number(req.body.quantity);
            //retrieve user data
            let user = await getDB()
                .collection(USER)
                .findOne({
                    _id: ObjectId(_id),
                });
            //Backend Validation
            if (!transactions.checkNumberRegex(quantity)) {
                throw "The quantity supplied is an invalid value.";
            }
            if (quantity > user.USD) {
                throw "You do not have enough USD to withdraw.";
            }
            //Modify user USD
            await getDB()
                .collection(USER)
                .updateOne(
                    {
                        _id: ObjectId(_id),
                    },
                    {
                        $inc: { USD: -quantity, totalWithdrew: quantity },
                    }
                );
            //Insert transaction document
            await getDB()
                .collection(TRANSACTIONS)
                .insertOne({
                    user_id: ObjectId(_id),
                    quantity: quantity,
                    type: "WITHDRAWAL",
                    timestamp: new Date().getTime(),
                });
            res.status(200);
            res.json({
                message: "Withdrawal success.",
            });
        } catch (e) {
            res.status(500);
            res.json({
                message: e,
            });
        }
    });

    //retrieves all transactions for the id of the user supplied
    app.get("/transactions/:id", async function (req, res) {
        try {
            let transactionsArray = await getDB()
                .collection(TRANSACTIONS)
                .find({
                    user_id: ObjectId(req.params.id),
                })
                .sort({
                    timestamp: -1,
                })
                .toArray();

            res.status(200);
            res.json({ transactions: transactionsArray });
        } catch (e) {
            res.status(500);
            res.json({
                message: "The user id supplied in the URL is invalid",
            });
        }
    });

    //Validate email and username for login purposes
    //returns user details
    app.get("/login", async function (req, res) {
        try {
            userDetails = await getDB().collection(USER).findOne({
                email: req.query.email,
                password: req.query.password,
            });

            if (!userDetails) {
                throw "Login is unsucessful. Please try again.";
            }

            res.status(200);
            res.json({
                message: userDetails,
            });
        } catch (e) {
            res.status(500);
            res.json({
                message: e,
            });
        }
    });

    //Get user details with user id
    app.get("/login/:id", async function (req, res) {
        userDetails = await getDB()
            .collection(USER)
            .findOne({
                _id: ObjectId(req.params.id),
            });

        res.status(200);
        res.json({
            message: userDetails,
        });
    });

    //initial seeding of countries
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

    //retrieves all allowed countries
    app.post("/country", async function (req, res) {
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
    //blacklist a country from the database
    app.delete("/country", async function (req, res) {
        let countryInput = req.body.country;

        try {
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
        let countryList = await getDB().collection(COUNTRY).find().sort({ name: 1 }).project({ _id: 0 }).toArray();
        let countryArray = [];
        for (let item of countryList) {
            countryArray.push(item.name);
        }

        res.status(200);
        res.json({ countryArray });
    });

    //Create a new prediction market in database
    //Recieves <if it is a political position> {position, country, description, politicians(array), timestampExpiry}
    app.post("/open_markets", async function (req, res) {
        let { position, country, description, politicians, timestampExpiry } = req.body;
        //Validation

        //Massaging the input
        let politiciansArray = [];
        for (let item of politicians) {
            let objectEntry = {};
            objectEntry.politician = item;
            objectEntry.yes = 2000;
            objectEntry.no = 2000;
            objectEntry.volume = 0;
            objectEntry.invariantK = objectEntry.yes * objectEntry.no;
            politiciansArray.push(objectEntry);
        }

        //Insert document after validation
        await getDB()
            .collection(OPEN_PREDICTION_MARKETS)
            .insertOne({
                position: position,
                country: country,
                description: description,
                politicians: politiciansArray,
                timestampCreated: new Date().getTime(),
                timestampExpiry: new Date(timestampExpiry).getTime(),
            });

        res.status(200);
        res.json({
            message: "Open Market successfully created.",
        });
    });

    //Retrieves all open markets in database
    app.get("/open_markets", async function (req, res) {
        let openMarketsArray = await getDB()
            .collection(OPEN_PREDICTION_MARKETS)
            .find()
            .sort({
                timestampCreated: 1,
            })
            .toArray();

        res.status(200);
        res.json({ openMarkets: openMarketsArray });
    });

    //retrieves a particular market only
    app.get("/open_markets/:id", async function (req, res) {
        try {
            let openMarketsArray = await getDB()
                .collection(OPEN_PREDICTION_MARKETS)
                .find({
                    _id: ObjectId(req.params.id),
                })
                .sort({
                    timestampCreated: 1,
                })
                .toArray();

            res.status(200);
            res.json({ openMarkets: openMarketsArray });
        } catch (e) {
            res.status(500);
            res.json({
                message: "The market id supplied in the URL is invalid",
            });
        }
    });

    //retrieves a user's balance for the market
    app.get("/balances/:market_id/:user_id", async function (req, res) {
        try {
            let returnArray = await getDB()
                .collection(BALANCES)
                .find({
                    market_id: ObjectId(req.params.market_id),
                    user_id: ObjectId(req.params.user_id),
                })
                .toArray();
            if (returnArray.length == 0) {
                returnArray = [{ yes: 0, no: 0 }];
            }

            res.status(200);
            res.json({ balances: { yes: returnArray[0].yes || 0, no: returnArray[0].no || 0 } });
        } catch (e) {
            res.status(500);
            res.json({
                message: e,
            });
        }
    });

    //Buy Sell Market Transaction
    app.put("/trade/:market_id/:user_id", async function (req, res) {
        try {
            //destructuring
            let { buyOrSell, yesOrNo, amount } = req.body;
            // Necessary validation
            // Check amount if not positive
            if (amount <= 0) throw "The amount supplied is invalid (Negative or Zero). Please re-try.";
            if (buyOrSell === "BUY") {
                //Check if the user's USD is >= $ to be spent
                let userDetails = await getDB()
                    .collection(USER)
                    .find(
                        {
                            _id: ObjectId(req.params.user_id),
                        },
                        { projection: { _id: 0, USD: 1 } }
                    )
                    .toArray();
                if (userDetails[0].USD < amount) throw "You do not have enough USD to buy.";
                //Perform the buy transaction
                if (yesOrNo === "YES") {
                    trade.tradeBuyYes(req.params.market_id, req.params.user_id, amount);
                } else if (yesOrNo === "NO") {
                    trade.tradeBuyNo(req.params.market_id, req.params.user_id, amount);
                } else {
                    throw "YES or NO token wasn't specified.";
                }
            } else if (buyOrSell === "SELL") {
                //Check if user's token is >= tokens to be spent
                let options = yesOrNo === "YES" ? { projection: { yes: 1 } } : { projection: { no: 1 } };
                options.projection._id = 0;
                let userTokenBalance = await getDB()
                    .collection(BALANCES)
                    .find(
                        {
                            market_id: ObjectId(req.params.market_id),
                            user_id: ObjectId(req.params.user_id),
                        },
                        options
                    )
                    .toArray();
                if ((userTokenBalance[0][yesOrNo === "YES" ? "yes" : "no"] || 0) < amount) {
                    throw "You do not have enough tokens to sell.";
                }
                //Perform the sell transaction
                if (yesOrNo === "YES") {
                    trade.tradeSellYes(req.params.market_id, req.params.user_id, amount);
                } else if (yesOrNo === "NO") {
                    trade.tradeSellNo(req.params.market_id, req.params.user_id, amount);
                } else {
                    throw "YES or NO token wasn't specified.";
                }
            } else {
                throw "This isn't a buy nor sell order.";
            }
            res.status(200);
            res.json({
                message: "Your order is a success!",
            });
        } catch (e) {
            res.status(500);
            res.json({
                message: e,
            });
        }
    });

    // Minting and Redeem
    app.put("/mint_redeem/:market_id/:user_id", async function (req, res) {
        try {
            //destructuring
            let { mintOrRedeem, amount } = req.body;
            if (mintOrRedeem === "MINT") {
                //check if USD amount is correct
                let userDetails = await getDB()
                    .collection(USER)
                    .find(
                        {
                            _id: ObjectId(req.params.user_id),
                        },
                        { projection: { _id: 0, USD: 1 } }
                    )
                    .toArray();
                if (userDetails[0].USD < amount) throw "You do not have enough USD to MINT that amount specified.";
                //Proceed with Minting
                trade.mintTokens(req.params.market_id, req.params.user_id, amount);
            } else if (mintOrRedeem === "REDEEM") {
                //Check if YES NO balance is correct
                let userTokenBalance = await getDB()
                    .collection(BALANCES)
                    .find(
                        {
                            market_id: ObjectId(req.params.market_id),
                            user_id: ObjectId(req.params.user_id),
                        },
                        { projection: { _id: 0, yes: 1, no: 1 } }
                    )
                    .toArray();
                if (Math.min(userTokenBalance[0].yes, userTokenBalance[0].no) < amount) {
                    throw "You do not have enough tokens to redeem.";
                }
                //Proceed with Redemption
                trade.redeemTokens(req.params.market_id, req.params.user_id, amount);
            } else {
                throw "MINT or REDEEM wasn't specified.";
            }

            res.status(200);
            res.json({
                message: "You have mint/redeemed successfully!",
            });
        } catch (e) {
            res.status(500);
            res.json({
                message: e,
            });
        }
    });

    // Liquidity
    app.put("/liquidity/:market_id/:user_id", async function (req, res) {
        try {
            //destructuring
            let { addOrRemove, amount } = req.body;
            //Logic - First pull out the ratio in the pool
            let openMarketsArray = await getDB()
                .collection(OPEN_PREDICTION_MARKETS)
                .find(
                    {
                        politicians: {
                            $elemMatch: { market_id: ObjectId(req.params.market_id) },
                        },
                    },
                    {
                        projection: { _id: 0, "politicians.$": 1 },
                    }
                )
                .toArray();

            if (addOrRemove === "ADD") {
                //the amount will refer to the number of yes tokens
                let ratio = openMarketsArray[0].politicians[0].no / openMarketsArray[0].politicians[0].yes;
                //the added amount will be amount, amount * ratio
                let liquidityShares = (amount / openMarketsArray[0].politicians[0].yes) * openMarketsArray[0].politicians[0].liquidityShares;

                //Logic - Secondly pull out user YES NO balance
                let userTokenBalance = await getDB()
                    .collection(BALANCES)
                    .find(
                        {
                            market_id: ObjectId(req.params.market_id),
                            user_id: ObjectId(req.params.user_id),
                        },
                        { projection: { _id: 0, yes: 1, no: 1 } }
                    )
                    .toArray();

                //Logic - Thirdly, check if these balances are enough to satisfy
                if (userTokenBalance[0].yes < amount || userTokenBalance[0].no < amount * ratio) {
                    throw "You do not have enough tokens to add liquidity at the pool's current ratio.";
                }
                // //Proceed with adding liquidity
                trade.addLiquidity(req.params.market_id, req.params.user_id, amount, amount * ratio, liquidityShares);
            } else if (addOrRemove === "REMOVE") {
                //Check if YES NO balance is correct
                let userTokenBalance = await getDB()
                    .collection(BALANCES)
                    .find(
                        {
                            market_id: ObjectId(req.params.market_id),
                            user_id: ObjectId(req.params.user_id),
                        },
                        { projection: { _id: 0, liquidityShares: 1 } }
                    )
                    .toArray();
                if (userTokenBalance[0].liquidityShares < amount) {
                    throw "You are trying to redeem more than your share of liquidity. It is not possible. ";
                }
                //Proceed with Redemption
                trade.removeLiquidity(req.params.market_id, req.params.user_id, amount, openMarketsArray[0].politicians[0].liquidityShares, openMarketsArray[0].politicians[0].yes, openMarketsArray[0].politicians[0].no);
            } else {
                throw "ADD or REMOVE wasn't specified.";
            }
            res.status(200);
            res.json({
                message: "You have added/removed liquidity successfully!",
            });
        } catch (e) {
            res.status(500);
            res.json({
                message: e,
            });
        }
    });
}

main();

// Use Home VSC http://127.0.0.1:8888/welcome
// Listen (must be the last)
app.listen(process.env.PORT || 3000, function () {
    console.log("Server has started");
});
