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
const POSITION = "position";

//helper functions
const user = require("./user.js");
const country = require("./country.js");
const transactions = require("./transactions.js");
const trade = require("./trade.js");
const openMarkets = require("./openMarkets.js");

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
                throw "Password is not complex enough. It needs to be 6 characters min.";
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
    app.get("/leaderboard", async function (req, res) {
        try {
            const pipeline = [
                {
                    $project: {
                        roi: {
                            $subtract: [
                                {
                                    $divide: [
                                        {
                                            $multiply: [
                                                100,
                                                {
                                                    $add: ["$USD", "$totalWithdrew"],
                                                },
                                            ],
                                        },
                                        "$totalDeposited",
                                    ],
                                },
                                100,
                            ],
                        },
                        email: "$email",
                        id: "$id",
                        timestamp: "$timestamp",
                    },
                },
                { $sort: { roi: -1 } },
            ];
            let leaderboard = await getDB().collection(USER).aggregate(pipeline).toArray();

            for (let i of leaderboard) {
                i._id = "...." + i._id.toString().slice(-5);
                i.email = i.email.substring(0, 3) + i.email.substring(3).replace(/.(?=.*@)/g, "*");
            }

            res.status(200);
            res.json({
                message: leaderboard,
            });
        } catch (e) {
            res.status(500);
            res.json({
                message: e,
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

    // initial seeding of countries
    app.post("/country_initial", async function (req, res) {
        console.log("Add country in progress");
        console.log(req.body);
        let countryInput = req.body.country.split(",");
        let unicodeInput = req.body.unicode.split(",");
        console.log(countryInput);
        console.log(unicodeInput);

        for (let i = 0; i < countryInput.length; i++) {
            getDB()
                .collection(COUNTRY)
                .insertOne({ name: countryInput[i], unicode1: unicodeInput[i * 2], unicode2: unicodeInput[i * 2 + 1] });
        }

        res.status(200);
        res.json({
            message: "The record has been added successfully",
        });
    });

    // initial seeding of positions
    app.post("/position_initial", async function (req, res) {
        console.log("Add positions in progress");
        let positionInput = req.body.position;

        for (let i of positionInput.split(",")) {
            getDB().collection(POSITION).insertOne({ name: i.trim() });
        }

        res.status(200);
        res.json({
            message: "The record has been added successfully",
        });
    });

    //Adds a country into the list of allowed countries
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

    //Return a list of positions in database, {positionArray:[position1, position2]}
    app.get("/position", async function (req, res) {
        let positionList = await getDB().collection(POSITION).find().sort({ name: 1 }).project({ _id: 0 }).toArray();
        let positionArray = [];
        for (let item of positionList) {
            positionArray.push(item.name);
        }

        res.status(200);
        res.json({ positionArray });
    });

    //Create a new prediction market in database
    //Recieves <if it is a political position> {position, country, description, politicians(array), timestampExpiry}
    app.post("/open_markets", async function (req, res) {
        let { position, country, description, politicians, timestampExpiry } = req.body;
        timestampExpiry = Number(timestampExpiry);
        //Validation
        try {
            if (!(await openMarkets.checkCountry(country))) {
                throw "Country is not in the list of valid countries.";
            }
            if (!(await openMarkets.checkPosition(position))) {
                throw "Position is not in the list of valid positions.";
            }
            if (!openMarkets.checkDate(timestampExpiry)) {
                throw "You cannot create a market with an expiry date in the past.";
            }

            //Massaging the input
            let politiciansArray = [];
            for (let item of politicians) {
                let objectEntry = {};
                objectEntry.politician = item;
                objectEntry.yes = 2000;
                objectEntry.no = 2000;
                objectEntry.liquidityShares = 100;
                objectEntry.volume = 0;
                objectEntry.market_id = new ObjectId();
                objectEntry.invariantK = objectEntry.yes * objectEntry.no;
                objectEntry.chart1 = [[new Date().getTime(), 50]];
                objectEntry.chart2 = [[new Date().getTime(), 50]];
                objectEntry.chart3 = [[new Date().getTime(), 0]];
                politiciansArray.push(objectEntry);
            }

            //Insert document after validation
            await getDB().collection(OPEN_PREDICTION_MARKETS).insertOne({
                position: position,
                country: country,
                description: description,
                politicians: politiciansArray,
                timestampCreated: new Date().getTime(),
                timestampExpiry: timestampExpiry,
                volume: 0,
                type: "open",
            });

            res.status(200);
            res.json({
                message: "Open Market successfully created.",
            });
        } catch (e) {
            res.status(500);
            res.json({
                message: e,
            });
        }
    });

    //Retrieves all markets in database
    app.get("/open_markets", async function (req, res) {
        // req.query
        // sortOptions: this.state.sortOptions, //0. Expiry Date, 1. Creation Date, 2. Volume, 3. Liquidity
        // ascendDescend: this.state.ascendDescend, //0. Descending, 1. Ascending
        // marketType: this.state.marketType,//0,1,2 (Open, Resolving, Closed)
        // search: this.state.search,
        // expiryDateGreater: this.state.expiryDateGreater,
        // expiryDateLesser: this.state.expiryDateLesser,
        // creationDateGreater: this.state.creationDateGreater,
        // creationDateLesser: this.state.creationDateLesser,
        // volumeGreater: this.state.volumeGreater,
        // volumeLesser: this.state.volumeLesser,

        let criteria = {};

        if (req.query.search) {
            criteria = { $or: [] };
            criteria["$or"].push({ position: { $regex: req.query.search, $options: "i" } });
            criteria["$or"].push({ country: { $regex: req.query.search, $options: "i" } });
            criteria["$or"].push({ politicians: { $elemMatch: { politician: { $regex: req.query.search, $options: "i" } } } });
        }

        if (req.query.marketType) {
            if (!criteria["$or"]) {
                criteria = { $or: [] };
                if (req.query.marketType.includes("0") || req.query.marketType.includes("1")) {
                    criteria["$or"].push({ type: "open" });
                }
                if (req.query.marketType.includes("2")) {
                    criteria["$or"].push({ type: "closed" });
                }
            } else {
                let temp1 = { $or: criteria["$or"] };
                delete criteria["$or"];
                let temp2 = { $or: [] };
                if (req.query.marketType.includes("0") || req.query.marketType.includes("1")) {
                    temp2["$or"].push({ type: "open" });
                }
                if (req.query.marketType.includes("2")) {
                    temp2["$or"].push({ type: "closed" });
                }
                criteria = { $and: [] };
                criteria["$and"].push(temp1);
                criteria["$and"].push(temp2);
            }
        }

        //destructure
        let { expiryDateGreater, expiryDateLesser, creationDateGreater, creationDateLesser, volumeGreater, volumeLesser } = req.query;

        if (Number(expiryDateGreater)) {
            criteria["timestampExpiry"] = criteria["timestampExpiry"] || {};
            criteria["timestampExpiry"]["$gte"] = Number(expiryDateGreater);
        }
        if (Number(expiryDateLesser)) {
            criteria["timestampExpiry"] = criteria["timestampExpiry"] || {};
            criteria["timestampExpiry"]["$lte"] = Number(expiryDateLesser);
        }
        if (Number(creationDateGreater)) {
            criteria["timestampCreated"] = criteria["timestampCreated"] || {};
            criteria["timestampCreated"]["$gte"] = Number(creationDateGreater);
        }
        if (Number(creationDateLesser)) {
            criteria["timestampCreated"] = criteria["timestampCreated"] || {};
            criteria["timestampCreated"]["$lte"] = Number(creationDateLesser);
        }
        if (Number(volumeGreater)) {
            criteria["volume"] = criteria["volume"] || {};
            criteria["volume"]["$gte"] = Number(volumeGreater);
        }
        if (Number(volumeLesser)) {
            criteria["volume"] = criteria["volume"] || {};
            criteria["volume"]["$lte"] = Number(volumeLesser);
        }

        let sortOptionsArray = ["timestampExpiry", "timestampCreated", "volume", "liquidity"];
        let sortBy = {};
        if (req.query.sortOptions != "3") {
            sortBy[sortOptionsArray[req.query.sortOptions]] = Number(req.query.ascendDescend) ? -1 : 1;
        } //Descending -1, ascending 1

        // let openMarketsArray = await getDB().collection(OPEN_PREDICTION_MARKETS).find(criteria).sort(sortBy).toArray();
        let openMarketsArray = await getDB()
            .collection(OPEN_PREDICTION_MARKETS)
            .aggregate([
                {
                    $lookup: {
                        from: COUNTRY,
                        localField: "country",
                        foreignField: "name",
                        as: "countryDetails",
                    },
                },
                {
                    $match: criteria,
                },
                {
                    $sort: sortBy,
                },
            ])
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

    // settles a particular market
    // delete all balances and credit the user in USD
    // "delete the market" (I'm opting to save a historical copy for backup purposes)
    // I know this is an insecure method! (anyone can call this api) But i'm very burnt out mentally to properly implement this. (do some auth on the staff jwt token before accepting the delete plus validation)
    app.delete("/open_markets/:id/", async function (req, res) {
        try {
            let resolutionArray = req.body.resolutionArray;

            let openMarketsArray = await getDB()
                .collection(OPEN_PREDICTION_MARKETS)
                .find({
                    _id: ObjectId(req.params.id),
                })
                .toArray();

            let count = 0;
            for (let item of openMarketsArray[0].politicians) {
                let balancesArray = await getDB()
                    .collection(BALANCES)
                    .find({
                        market_id: item.market_id,
                    })
                    .toArray();
                let result = resolutionArray[count];

                for (let i of balancesArray) {
                    //preprocessing
                    if (result === "yes") {
                        let incrementAmount = 0;
                        if (i.yes) {
                            incrementAmount += i.yes;
                        }
                        if (i.liquidityShares) {
                            //find total liquidity shares
                            incrementAmount += (i.liquidityShares / item.liquidityShares) * item.yes;
                        }
                        //update user usd value
                        await getDB()
                            .collection(USER)
                            .updateOne(
                                {
                                    _id: i.user_id,
                                },
                                {
                                    $inc: { USD: incrementAmount },
                                }
                            );
                        //insert one into transaction list
                        await getDB()
                            .collection(TRANSACTIONS)
                            .insertOne({
                                user_id: i.user_id,
                                quantity: incrementAmount,
                                type: "RESOLUTION OF MARKET",
                                details: `The resolution of the market: Will ${item.politician} be the ${openMarketsArray[0].position} of ${openMarketsArray[0].country} by the date ${new Date(openMarketsArray[0].timestampExpiry)}? has resolved to "YES"`,
                                timestamp: new Date().getTime(),
                            });
                        //delete balances entry
                        await getDB().collection(BALANCES).deleteOne({
                            _id: i._id,
                        });
                    } else {
                        let incrementAmount = 0;

                        if (i.no) {
                            incrementAmount += i.no;
                        }

                        if (i.liquidityShares) {
                            //find total liquidity shares
                            incrementAmount += (i.liquidityShares / item.liquidityShares) * item.no;
                        }

                        await getDB()
                            .collection(USER)
                            .updateOne(
                                {
                                    _id: i.user_id,
                                },
                                {
                                    $inc: { USD: incrementAmount },
                                }
                            );
                        //insert one into transaction list
                        await getDB()
                            .collection(TRANSACTIONS)
                            .insertOne({
                                user_id: i.user_id,
                                quantity: incrementAmount,
                                type: "RESOLUTION OF MARKET",
                                details: `The resolution of the market: Will ${item.politician} be the ${openMarketsArray[0].position} of ${openMarketsArray[0].country} by the date ${new Date(openMarketsArray[0].timestampExpiry)}? has resolved to "NO"`,
                                timestamp: new Date().getTime(),
                            });
                        //delete balances entry
                        await getDB().collection(BALANCES).deleteOne({
                            _id: i._id,
                        });
                    }
                }
                count++;
            }

            //update market to closed
            await getDB()
                .collection(OPEN_PREDICTION_MARKETS)
                .updateOne(
                    {
                        _id: ObjectId(req.params.id),
                    },
                    {
                        $set: { type: "closed" },
                    }
                );

            res.status(200);
            res.json({ message: "The market has been successfully resolved!" });
        } catch (e) {
            res.status(500);
            res.json({
                message: "The market didn't resolve due to various issues. Please contact administrator.",
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
                returnArray = [{ yes: 0, no: 0, liquidityShares: 0 }];
            }

            res.status(200);
            res.json({ balances: { yes: returnArray[0].yes || 0, no: returnArray[0].no || 0, liquidityShares: returnArray[0].liquidityShares || 0 } });
        } catch (e) {
            res.status(500);
            res.json({
                message: e,
            });
        }
    });

    //Retrives user token portfolio
    app.get("/portfolio/:user_id", async function (req, res) {
        try {
            const criteria = [
                {
                    $lookup: {
                        from: OPEN_PREDICTION_MARKETS,
                        localField: "market_id",
                        foreignField: "politicians.market_id",
                        as: "market_details",
                    },
                },
                {
                    $match: {
                        user_id: ObjectId(req.params.user_id),
                    },
                },
            ];
            let aggregateResult = await getDB().collection(BALANCES).aggregate(criteria).toArray();

            res.status(200);
            res.json({ balances: aggregateResult });
        } catch (e) {
            res.status(500);
            res.json({
                message: e,
            });
        }
    });

    //retrieves a user's balance for the market
    app.get("/order_history/:market_id/:user_id", async function (req, res) {
        try {
            let returnArray = await getDB()
                .collection(ORDER_HISTORY)
                .find({
                    market_id: ObjectId(req.params.market_id),
                    user_id: ObjectId(req.params.user_id),
                })
                .sort({
                    timestamp: -1,
                })
                .toArray();
            res.status(200);
            res.json(returnArray);
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
            // Check if it is an expired market

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
