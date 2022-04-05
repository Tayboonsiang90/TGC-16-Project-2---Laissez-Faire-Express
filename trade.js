//Useful DB Tools
const { getDB, connect } = require("./MongoUtil.js");
const { ObjectId } = require("mongodb");
const MONGO_URI = process.env.MONGO_URI;

module.exports = {
    tradeBuyYes,
    tradeBuyNo,
    tradeSellYes,
    tradeSellNo,
    mintTokens,
    redeemTokens,
    addLiquidity,
    removeLiquidity,
};

//This function takes in a submitted country and check if its repeated
//Returns true if not repeated,
async function tradeBuyYes(market_id, user_id, amount) {
    let marketDetails = await getDB()
        .collection("openPredictionMarkets")
        .find({ politicians: { $elemMatch: { market_id: ObjectId(market_id) } } })
        .project({ _id: 0, "politicians.$": 1 })
        .toArray();
    let yesTokens = marketDetails[0].politicians[0].yes;
    let noTokens = marketDetails[0].politicians[0].no;
    let invariantK = marketDetails[0].politicians[0].invariantK;
    let price = (noTokens + amount) / (invariantK / (noTokens + amount) + (noTokens + amount));
    //Update x, y and volume
    await getDB()
        .collection("openPredictionMarkets")
        .updateOne(
            {
                politicians: {
                    $elemMatch: { market_id: ObjectId(market_id) },
                },
            },
            {
                $inc: { "politicians.$.no": amount, "politicians.$.volume": amount, volume: amount },
                $set: { "politicians.$.yes": invariantK / (noTokens + amount) },
                $push: { "politicians.$.chart": [new Date().getTime(), price] },
            }
        );
    //update USD balance of user
    await getDB()
        .collection("user")
        .updateOne(
            {
                _id: ObjectId(user_id),
            },
            {
                $inc: {
                    USD: -amount,
                },
            }
        );
    //update token balance of user
    await getDB()
        .collection("balances")
        .updateOne(
            {
                market_id: ObjectId(market_id),
                user_id: ObjectId(user_id),
            },
            {
                $inc: { yes: yesTokens + amount - invariantK / (noTokens + amount) },
            },
            {
                upsert: true,
            }
        );
    //update Order History
    await getDB()
        .collection("orderHistory")
        .insertOne({
            market_id: ObjectId(market_id),
            user_id: ObjectId(user_id),
            type: "TRADE",
            buyOrSell: "BUY",
            yesOrNo: "YES",
            quantity: yesTokens + amount - invariantK / (noTokens + amount),
            quantityInUSD: amount,
            timestamp: new Date().getTime(),
        });
}

async function tradeBuyNo(market_id, user_id, amount) {
    let marketDetails = await getDB()
        .collection("openPredictionMarkets")
        .find({ politicians: { $elemMatch: { market_id: ObjectId(market_id) } } })
        .project({ _id: 0, "politicians.$": 1 })
        .toArray();
    let yesTokens = marketDetails[0].politicians[0].yes;
    let noTokens = marketDetails[0].politicians[0].no;
    let invariantK = marketDetails[0].politicians[0].invariantK;
    let price = invariantK / (yesTokens + amount) / (invariantK / (yesTokens + amount) + (yesTokens + amount));
    //Update x, y and volume
    await getDB()
        .collection("openPredictionMarkets")
        .updateOne(
            {
                politicians: {
                    $elemMatch: { market_id: ObjectId(market_id) },
                },
            },
            {
                $inc: { "politicians.$.yes": amount, "politicians.$.volume": amount, volume: amount },
                $set: { "politicians.$.no": invariantK / (yesTokens + amount) },
                $push: { "politicians.$.chart": [new Date().getTime(), price] },
            }
        );
    //update USD balance of user
    await getDB()
        .collection("user")
        .updateOne(
            {
                _id: ObjectId(user_id),
            },
            {
                $inc: {
                    USD: -amount,
                },
            }
        );
    //update token balance of user
    await getDB()
        .collection("balances")
        .updateOne(
            {
                market_id: ObjectId(market_id),
                user_id: ObjectId(user_id),
            },
            {
                $inc: { no: noTokens + amount - invariantK / (yesTokens + amount) },
            },
            {
                upsert: true,
            }
        );
    //update Order History
    await getDB()
        .collection("orderHistory")
        .insertOne({
            market_id: ObjectId(market_id),
            user_id: ObjectId(user_id),
            type: "TRADE",
            buyOrSell: "BUY",
            yesOrNo: "NO",
            quantity: noTokens + amount - invariantK / (yesTokens + amount),
            quantityInUSD: amount,
            timestamp: new Date().getTime(),
        });
}

async function tradeSellYes(market_id, user_id, amount) {
    let marketDetails = await getDB()
        .collection("openPredictionMarkets")
        .find({ politicians: { $elemMatch: { market_id: ObjectId(market_id) } } })
        .project({ _id: 0, "politicians.$": 1 })
        .toArray();
    let yesTokens = marketDetails[0].politicians[0].yes;
    let noTokens = marketDetails[0].politicians[0].no;
    let invariantK = marketDetails[0].politicians[0].invariantK;
    let amountInDollar = (amount - yesTokens - noTokens + Math.sqrt((yesTokens + noTokens - amount) ** 2 + 4 * amount * yesTokens)) / 2;
    //Update x, y and volume
    await getDB()
        .collection("openPredictionMarkets")
        .updateOne(
            {
                politicians: {
                    $elemMatch: { market_id: ObjectId(market_id) },
                },
            },
            {
                $inc: { "politicians.$.yes": amountInDollar, "politicians.$.volume": amountInDollar, volume: amountInDollar },
                $set: { "politicians.$.no": invariantK / (yesTokens + amountInDollar) },
            }
        );
    //update USD balance of user
    await getDB()
        .collection("user")
        .updateOne(
            {
                _id: ObjectId(user_id),
            },
            {
                $inc: {
                    USD: amount - amountInDollar,
                },
            }
        );
    //update token balance of user
    await getDB()
        .collection("balances")
        .updateOne(
            {
                market_id: ObjectId(market_id),
                user_id: ObjectId(user_id),
            },
            {
                $inc: { yes: -amount },
            },
            {
                upsert: true,
            }
        );
    //update Order History
    await getDB()
        .collection("orderHistory")
        .insertOne({
            market_id: ObjectId(market_id),
            user_id: ObjectId(user_id),
            type: "TRADE",
            buyOrSell: "SELL",
            yesOrNo: "YES",
            quantity: amount,
            quantityInUSD: amount - amountInDollar,
            timestamp: new Date().getTime(),
        });
}

async function tradeSellNo(market_id, user_id, amount) {
    let marketDetails = await getDB()
        .collection("openPredictionMarkets")
        .find({ politicians: { $elemMatch: { market_id: ObjectId(market_id) } } })
        .project({ _id: 0, "politicians.$": 1 })
        .toArray();
    let yesTokens = marketDetails[0].politicians[0].yes;
    let noTokens = marketDetails[0].politicians[0].no;
    let invariantK = marketDetails[0].politicians[0].invariantK;
    let amountInDollar = (amount - yesTokens - noTokens + Math.sqrt((yesTokens + noTokens - amount) ** 2 + 4 * amount * noTokens)) / 2;
    //Update x, y and volume
    await getDB()
        .collection("openPredictionMarkets")
        .updateOne(
            {
                politicians: {
                    $elemMatch: { market_id: ObjectId(market_id) },
                },
            },
            {
                $inc: { "politicians.$.no": amountInDollar, "politicians.$.volume": amountInDollar, volume: amountInDollar },
                $set: { "politicians.$.yes": invariantK / (noTokens + amountInDollar) },
            }
        );
    //update USD balance of user
    await getDB()
        .collection("user")
        .updateOne(
            {
                _id: ObjectId(user_id),
            },
            {
                $inc: {
                    USD: amount - amountInDollar,
                },
            }
        );
    //update token balance of user
    await getDB()
        .collection("balances")
        .updateOne(
            {
                market_id: ObjectId(market_id),
                user_id: ObjectId(user_id),
            },
            {
                $inc: { no: -amount },
            },
            {
                upsert: true,
            }
        );
    //update Order History
    await getDB()
        .collection("orderHistory")
        .insertOne({
            market_id: ObjectId(market_id),
            user_id: ObjectId(user_id),
            type: "TRADE",
            buyOrSell: "SELL",
            yesOrNo: "NO",
            quantity: amount,
            quantityInUSD: amount - amountInDollar,
            timestamp: new Date().getTime(),
        });
}

async function mintTokens(market_id, user_id, amount) {
    //update USD balance of user
    await getDB()
        .collection("user")
        .updateOne(
            {
                _id: ObjectId(user_id),
            },
            {
                $inc: {
                    USD: -amount,
                },
            }
        );
    //update token balance of user
    await getDB()
        .collection("balances")
        .updateOne(
            {
                market_id: ObjectId(market_id),
                user_id: ObjectId(user_id),
            },
            {
                $inc: { no: amount, yes: amount },
            },
            {
                upsert: true,
            }
        );
    //update Order History
    await getDB()
        .collection("orderHistory")
        .insertOne({
            market_id: ObjectId(market_id),
            user_id: ObjectId(user_id),
            type: "MINT",
            quantity: amount,
            timestamp: new Date().getTime(),
        });
}

async function redeemTokens(market_id, user_id, amount) {
    //update USD balance of user
    await getDB()
        .collection("user")
        .updateOne(
            {
                _id: ObjectId(user_id),
            },
            {
                $inc: {
                    USD: amount,
                },
            }
        );
    //update token balance of user
    await getDB()
        .collection("balances")
        .updateOne(
            {
                market_id: ObjectId(market_id),
                user_id: ObjectId(user_id),
            },
            {
                $inc: { no: -amount, yes: -amount },
            },
            {
                upsert: true,
            }
        );
    //update Order History
    await getDB()
        .collection("orderHistory")
        .insertOne({
            market_id: ObjectId(market_id),
            user_id: ObjectId(user_id),
            type: "REDEEM",
            quantity: amount,
            timestamp: new Date().getTime(),
        });
}

async function addLiquidity(market_id, user_id, amountYes, amountNo, liquidityShares) {
    //update market tokens
    await getDB()
        .collection("openPredictionMarkets")
        .updateOne(
            {
                politicians: {
                    $elemMatch: { market_id: ObjectId(market_id) },
                },
            },
            {
                $inc: { "politicians.$.yes": amountYes, "politicians.$.no": amountNo, "politicians.$.liquidityShares": liquidityShares },
            }
        );
    //update token balance of user
    await getDB()
        .collection("balances")
        .updateOne(
            {
                market_id: ObjectId(market_id),
                user_id: ObjectId(user_id),
            },
            {
                $inc: { no: -amountYes, yes: -amountNo, liquidityShares: liquidityShares },
            },
            {
                upsert: true,
            }
        );
    //update Order History
    await getDB()
        .collection("orderHistory")
        .insertOne({
            market_id: ObjectId(market_id),
            user_id: ObjectId(user_id),
            type: "ADD LIQUIDITY",
            quantityYes: amountYes,
            quantityNo: amountNo,
            liquidityShares: liquidityShares,
            timestamp: new Date().getTime(),
        });
}

async function removeLiquidity(market_id, user_id, shares, totalShares, yesTokens, noTokens) {
    //update market tokens
    await getDB()
        .collection("openPredictionMarkets")
        .updateOne(
            {
                politicians: {
                    $elemMatch: { market_id: ObjectId(market_id) },
                },
            },
            {
                $inc: { "politicians.$.yes": -(shares / totalShares) * yesTokens, "politicians.$.no": -(shares / totalShares) * noTokens, "politicians.$.liquidityShares": -shares },
            }
        );
    //update token balance of user
    await getDB()
        .collection("balances")
        .updateOne(
            {
                market_id: ObjectId(market_id),
                user_id: ObjectId(user_id),
            },
            {
                $inc: { yes: (shares / totalShares) * yesTokens, no: (shares / totalShares) * noTokens, liquidityShares: -shares },
            },
            {
                upsert: true,
            }
        );
    //update Order History
    await getDB()
        .collection("orderHistory")
        .insertOne({
            market_id: ObjectId(market_id),
            user_id: ObjectId(user_id),
            type: "REMOVE LIQUIDITY",
            quantityYes: (shares / totalShares) * yesTokens,
            quantityNo: (shares / totalShares) * noTokens,
            liquidityShares: shares,
            timestamp: new Date().getTime(),
        });
}

//http://127.0.0.1:8888/trade/624027502212b34e3982cf80/623a7ac20e44ba2442874663
// {
//   "buyOrSell": "SELL",
//   "yesOrNo" : "NO",
//   "amount" : 1000
// }
