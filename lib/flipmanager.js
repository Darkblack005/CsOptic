'use strict'

const config = require('../config')
const async = require('async')
const mongoose = require('mongoose')
const crypto = require('crypto');


function FlipManager(params) {
    this.currentflips = []
    this.currentFlipsDataForPublic = null
    this.currentseeds = []
    this.currentPendingJoiners = []
    this.currentJoined = []

    this.coinflipschema = new mongoose.Schema({
        steamid1: { type: String },
        steamid2: { type: String },
        serverseed: { type: String },
        clientseed: { type: String },
        hash: { type: String },
        date: { type: Date, default: Date.now, required: true }
    })

    this.coinflipmodel = mongoose.model('coinflip', this.coinflipschema)

    var options = {
        user: config.dbUser,
        pass: config.dbPassword
    }

    mongoose.connect('mongodb://localhost/coinflips', options, function (error) {
        // Check error in initial connection. There is no 2nd param to the callback.
        if (!error) {
            console.log('[!] Connected to MongoDB')
        } else {
            console.log(error)
        }
    })

    this.Trade = null
    this.io = params.io || false
}

FlipManager.prototype.getCurrentFlips = function getCurrentFlips() {
    return this.currentFlipsDataForPublic
}

FlipManager.prototype.createNewServerSeed = function createNewFlip(id, callback) {
    var hmac = crypto.createHash('sha256')
    var serverSeed = crypto.randomBytes(48).toString('hex')

    this.currentseeds.push({
        steamID64: id,
        seed: serverSeed
    })

    hmac.update(serverSeed)

    var hash = hmac.digest('hex')
    callback(hash)
}

FlipManager.prototype.createNewFlip = function createNewFlip(data, itemsAndDetails) {
    var hmac = crypto.createHash('sha256')
    var serverSeed = -1

    for (var i = 0; i < this.currentseeds.length; i++) {
        if (this.currentseeds[i] && this.currentseeds[i].steamID64 == data.steamID64) {
            serverSeed = this.currentseeds[i].seed
            break
        }
    }

    if (serverSeed == -1) {
        console.log('ERROR server seed not found for given steamid')
        console.log('this.currentseeds:')
        console.log(this.currentseeds)
        console.log('data:')
        console.log(data)
    }

    hmac.update(serverSeed + data.clientSeed)
    var hash = hmac.digest('hex')

    this.currentflips.push({
        flipDetails: data,
        itemsAndDetails: itemsAndDetails,
        serverSeed: serverSeed,
        finalHash: hash,
        joinable: false
    })
}

FlipManager.prototype.tradeAccepted = function tradeAccepted(steamID64) {
    console.log('Trade accepted')
    var isAJoiner = false
    var j

    if (!this.currentFlipsDataForPublic) {
        this.currentFlipsDataForPublic = []
    }

    for (j = 0; j < this.currentPendingJoiners.length; j++) {
        if (this.currentPendingJoiners[j] && this.currentPendingJoiners[j].data.steamID64 == steamID64) {
            isAJoiner = true
            console.log('Determined user is a joiner')
            break
        }
    }

    if (!isAJoiner) {
        for (var i = 0; i < this.currentflips.length; i++) {
            if (this.currentflips[i] && this.currentflips[i].flipDetails.steamID64 == steamID64) {
                this.currentFlipsDataForPublic.push({
                    flipDetails: this.currentflips[i].flipDetails,
                    itemsAndDetails: this.currentflips[i].itemsAndDetails,
                    finalHash: this.currentflips[i].finalHash,
                    joinable: true
                })

                this.currentflips[i].joinable = true

                break
            }
        }
    } else {
        console.log('Changing data on a flip because a user joined')
        this.currentJoined[j] = this.currentPendingJoiners[j]
        delete this.currentPendingJoiners[j]

        this.currentflips[this.currentJoined[j].data.flipId].joinData = this.currentJoined[j]

        this.currentFlipsDataForPublic[this.currentJoined[j].data.flipId].joinData = this.currentJoined[j]

        this.io.emit('flip update', {})

        this.evaluateFlip(steamID64)
    }
}

FlipManager.prototype.evaluateFlip = function evaluateFlip(steamID64) {
    console.log('Evaluating flip . . .')

    for (var i = 0; i < this.currentJoined.length; i++) {
        if (this.currentJoined[i].data.steamID64 == steamID64) {
            console.log('Found steamid in evaluate flip')
            this.sendWinner(parseInt(this.currentflips[i].serverSeed + this.currentflips[i].flipDetails.clientSeed, 16) % 100 > 49, i)
            break
        }
    }
}

// T 0-49
// CT 50-99
// Convert old assetids in coinflip to new assetids, store in an array
// Get the prices of all of them
// Find any that are within 0%-8% of the total value of the flip
// Delete those from the array and create a trade offer for the rest of the items to go to the winner
// Set a timeout to delete the flip
FlipManager.prototype.sendWinner = function sendWinner(ctWin, coinflipIndex) {
    Trade.getInventory(76561198159926602, '730', '2', (err, data) => {

        if (err) {
            console.log(err)
        }

        const userInventory = data
        var flipItems = []
        var commission = 0
        var totalValue = coinflips[coinflipIndex].itemsAndDetails.value + coinflips[coinflipIndex].joinData.itemsAndDetails.value

        coinflips[coinflipIndex].itemsAndDetails.items.forEach(function (e) {
            flipItems.push(Trade.assetIdMap[e.assetid])
            delete Trade.assetIdMap[e.assetid]
        })

        coinflips[coinflipIndex].joinData.itemsAndDetails.items.forEach(function (e) {
            flipItems.push(Trade.assetIdMap[e.assetid])
            delete Trade.assetIdMap[e.assetid]
        })

        async.forEach(flipItems, (index, cb) => {
            const item = userInventory[index]
            const price = Trade.getPrice(item.data.market_hash_name, 'user', item.item_type)

            if (price <= totalValue * config.rates.commissionPercentage && commission < totalValue * config.rates.commissionPercentage) {
                delete flipItems[item]
                commission += price
                console.log('Taking ' + item.data.market_hash_name + ' as commission')
            }

            cb()
        }, () => {
            console.log('Taking ' + commission + ' as commission from the flip made by ' + coinflips[coinflipIndex].flipDetails.name + '(' + coinflips[coinflipIndex].flipDetails.steamID64 + ')')

            // Send items back
            var itemObjectArrayToSend = flipItems.map(assetid => ({
                assetid,
                appid: 730,
                contextid: 2,
                amount: 1
            }))

            const Bot = Trade.getBot(0)

            // This is a total hack
            if(!coinflips[coinflipIndex].flipDetails.side && !ctWin) {
                var booloverride = true
            }

            const offer = Bot.manager.createOffer(booloverride || (coinflips[coinflipIndex].flipDetails.side && ctWin) ? coinflips[coinflipIndex].flipDetails.tradelink : coinflips[coinflipIndex].joinData.data.tradelink)

            offer.addTheirItems(itemObjectArrayToSend)
            offer.setMessage(config.tradeMessage)

            offer.getUserDetails((detailsError, me, them) => {
                if (detailsError) {
                    console.log('Details error: ' + detailsError)

                    socket.emit('offer status', {
                        error: detailsError,
                        status: false,
                    })
                } else if (me.escrowDays + them.escrowDays > 0) {

                    socket.emit('offer status', {
                        error: 'You must have 2FA enabled, we do not accept trades that go into Escrow.',
                        status: false,
                    })
                } else {
                    offer.send((errSend, status) => {
                        if (errSend) {
                            socket.emit('offer status', {
                                error: errSend,
                                status: false,
                            })
                        } else {
                            console.log('[!!!!!] Sent a trade: ', data)
                            if (status === 'pending') {
                                socket.emit('offer status', {
                                    error: null,
                                    status: 2,
                                })
                                Trade.botConfirmation(data.bot_id, offer.id, (errConfirm) => {
                                    if (!errConfirm) {
                                        socket.emit('offer status', {
                                            error: null,
                                            status: 3,
                                            offer: offer.id,
                                        })
                                    } else {
                                        socket.emit('offer status', {
                                            error: errConfirm,
                                            status: false,
                                        })
                                    }
                                })
                            } else {
                                socket.emit('offer status', {
                                    error: null,
                                    status: 3,
                                    offer: offer.id,
                                })
                            }
                        }
                    })
                }
            })
        })
    })
}

FlipManager.prototype.getFlipValueByFlipIndex = function getFlipValueByFlipIndex(index) {
    return this.currentflips[index].itemsAndDetails.value ? this.currentflips[index].itemsAndDetails.value : -1
}

FlipManager.prototype.changeFlipJoinableByFlipIndex = function changeFlipJoinableByFlipIndex(index, newVal, callback) {
    this.currentflips[index].joinable = newVal
    this.currentFlipsDataForPublic[index].joinable = newVal

    callback()
}

FlipManager.prototype.joinFlip = function joinFlip(dataPassed, itemsAndDetailsPassed) {
    this.currentPendingJoiners[dataPassed.flipId] = {
        data: dataPassed,
        itemsAndDetails: itemsAndDetailsPassed
    }
}

FlipManager.prototype.storeFlipToDB = function storeFlipToDB() {

}



module.exports = FlipManager