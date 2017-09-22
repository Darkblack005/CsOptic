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
    this.winningsOwed = []

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

    var foundUndefined = false
    var foundUndefinedValue = 0
    for(var i = 0; i < this.currentseeds.length; i++) {
        if(typeof this.currentseeds[i] == 'undefined' || typeof this.currentseeds[i] == 'null') {
            foundUndefined = true
            foundUndefinedValue = i
            break
        }
    }

    hmac.update(serverSeed)
    var hash = hmac.digest('hex')

    if(foundUndefined) {
        this.currentseeds[foundUndefinedValue] = {
            steamID64: id,
            seed: serverSeed,
            serverHash: hash
        }
    } else {
        this.currentseeds.push({
            steamID64: id,
            seed: serverSeed,
            serverHash: hash
        })
    }

    callback(hash)
}

FlipManager.prototype.createNewFlip = function createNewFlip(data, itemsAndDetails) {
    var hmac = crypto.createHash('sha256')
    var serverSeed = -1
    var serverHash = -1

    for (var i = 0; i < this.currentseeds.length; i++) {
        if (this.currentseeds[i] && this.currentseeds[i].steamID64 == data.steamID64) {
            serverSeed = this.currentseeds[i].seed
            serverHash = this.currentseeds[i].serverHash
            delete this.currentseeds[i]
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

    var foundUndefined = false;
    var foundUndefinedValue = 0;
    for(var i = 0; i < this.currentflips.length; i++) {
        if(typeof this.currentflips[i] == 'undefined' || typeof this.currentflips[i] == 'null') {
            console.log('found an open spot')
            foundUndefinedValue = i;
            foundUndefined = true;
            break;
        }
    }

    // Since we're just delete'ing flips when theyre over we have to find where they were deleted and fill in those 'null's
    if(foundUndefined == false) {
        this.currentflips.push({
            flipDetails: data,
            itemsAndDetails: itemsAndDetails,
            serverSeed: serverSeed,
            serverHash: serverHash,
            finalHash: hash,
            joinable: false
        })
        foundUndefinedValue = this.currentflips.length - 1
        console.log('pushing new flip')
    } else {
        this.currentflips[foundUndefinedValue] = {
            flipDetails: data,
            itemsAndDetails: itemsAndDetails,
            serverSeed: serverSeed,
            serverHash: serverHash,
            finalHash: hash,
            joinable: false
        }
        console.log('taking spot ' + foundUndefinedValue + ' in currentflips for a new flip')
    }

    //this.removeFlipAfterTimeout(foundUndefinedValue, true)
    
}

FlipManager.prototype.flipCanceled = function flipCanceled(steamID64) {
    console.log('Trade canceled')
    var isAJoiner = false
    var j

    for (j = 0; j < this.currentPendingJoiners.length; j++) {
        if (this.currentPendingJoiners[j] && this.currentPendingJoiners[j].data.steamID64 == steamID64) {
            isAJoiner = true
            console.log('Determined canceler is a joiner')
            break
        }
    }

    if (!isAJoiner) {
        for (var i = 0; i < this.currentflips.length; i++) {
            if (this.currentflips[i] && this.currentflips[i].flipDetails.steamID64 == steamID64) {
                delete this.currentflips[i]

                break
            }
        }
    } else {
        console.log('Deleting current pending joiner:')
        console.log(this.currentPendingJoiners[j])
        delete this.currentPendingJoiners[j]
    }
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
                this.currentFlipsDataForPublic[i] = {
                    flipDetails: this.currentflips[i].flipDetails,
                    itemsAndDetails: this.currentflips[i].itemsAndDetails,
                    finalHash: this.currentflips[i].finalHash,
                    serverHash: this.currentflips[i].serverHash,
                    joinable: true
                }

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

        this.evaluateFlip(this.currentJoined[j].data.flipId)
    }
}

FlipManager.prototype.evaluateFlip = function evaluateFlip(flipId) {
    console.log('Evaluating flip . . .')

    //number is going to be between 0 and 99, 99/2 = 49.5
    // ct wins if number is greater than 50
    var ctWin = parseInt(this.currentflips[flipId].serverSeed + this.currentflips[flipId].flipDetails.clientSeed, 16) % 100 > 50

    console.log('Server seed plus client seed: ' + this.currentflips[flipId].serverSeed + this.currentflips[flipId].flipDetails.clientSeed)
    console.log(parseInt(this.currentflips[flipId].serverSeed + this.currentflips[flipId].flipDetails.clientSeed, 16) % 100)

    this.io.emit('coinflip winner', {
        id: flipId,
        didCtWin: ctWin
    })

    this.currentflips[flipId].ctWin = ctWin
    this.currentFlipsDataForPublic[flipId].ctWin = ctWin

    this.sendWinner(ctWin, flipId)
}

FlipManager.prototype.sendWinner = function sendWinner(ctWin, coinflipIndex) {
    var self = this
    self.Trade.getInventory('76561198159926602', '730', '2', (err, data) => {

        if (err) {
            console.log(err)
        } else { 
            console.log('got bot inventory inventory')
        }

        const userInventory = data
        var flipItems = []
        var commission = 0
        var totalValue = self.currentflips[coinflipIndex].itemsAndDetails.value + self.currentflips[coinflipIndex].joinData.itemsAndDetails.value

        self.currentflips[coinflipIndex].itemsAndDetails.items.forEach(function (e) {
            flipItems.push(self.Trade.assetIdMap.get(e.assetid))
            self.Trade.assetIdMap.delete(e.assetid)
        })

        self.currentflips[coinflipIndex].joinData.itemsAndDetails.items.forEach(function (e) {
            flipItems.push(self.Trade.assetIdMap.get(e.assetid))
            self.Trade.assetIdMap.delete(e.assetid)
        })

        console.log('flipItems:')
        console.log(flipItems)
        var toDelete = []

        async.forEach(flipItems, (index, cb) => {
            const item = userInventory[index]
            console.log('assetid: ' + index)
            console.log('item:')
            console.log(item)
            const price = self.Trade.getPrice(item.data.market_hash_name, 'user', item.item_type)

            if (price <= totalValue * config.rates.commissionPercentage && commission <= totalValue * config.rates.commissionPercentage) {
                commission += price
                console.log('*************************************************************************************************************************')
                console.log('Taking ' + item.data.market_hash_name + ' as commission')
                console.log('*************************************************************************************************************************')
                toDelete.push(item)
            }

            cb()
        }, () => {
            console.log('*************************************************************************************************************************')
            console.log('Taking $' + commission + ' as commission from the flip made by ' + self.currentflips[coinflipIndex].flipDetails.name + ' (' + self.currentflips[coinflipIndex].flipDetails.steamID64 + ')')
            console.log('*************************************************************************************************************************')

            toDelete.forEach(function(e) {
                flipItems.splice(flipItems.indexOf(e), 1)
            })

            // Send items back
            var itemObjectArrayToSend = flipItems.map(assetid => ({
                assetid,
                appid: 730,
                contextid: 2,
                amount: 1
            }))

            const Bot = self.Trade.getBot(Object.keys(config.bots)[0])

            var booloverride = false

            // This is a total hack
            if(!self.currentflips[coinflipIndex].flipDetails.side && !ctWin) {
                booloverride = true
            }

            var creatorWon = booloverride || (self.currentflips[coinflipIndex].flipDetails.side && ctWin)
            const winnerTradeLink = creatorWon ? self.currentflips[coinflipIndex].flipDetails.tradelink : self.currentflips[coinflipIndex].joinData.data.tradelink
            console.log('Did the creator win? ' + creatorWon)
            console.log('Winners tradelink ' + winnerTradeLink)
            const offer = Bot.manager.createOffer(winnerTradeLink)

            offer.addMyItems(itemObjectArrayToSend)
            console.log(itemObjectArrayToSend)
            offer.setMessage(config.tradeMessage)

            var weAlreadyOwe = false
            for(var i = 0; i < self.winningsOwed.length; i++) {
                if(self.winningsOwed[i].tl == winnerTradeLink) {
                    weAlreadyOwe = true

                    self.winningsOwed[i].items.push(flipItems)

                    break
                }
            }

            if(!weAlreadyOwe) {
                 self.winningsOwed.push({
                     tl: winnerTradeLink,
                     items: flipItems
                })
            }

            offer.getUserDetails((detailsError, me, them) => {
                if (detailsError) {
                    console.log('Details error: ' + detailsError)

                    self.io.emit('offer status', {
                        error: detailsError,
                        status: false,
                        tl: winnerTradeLink
                    })
                } else if (me.escrowDays + them.escrowDays > 0) {
                     self.io.emit('offer status', {
                        error: 'You must have 2FA enabled, we do not accept trades that go into Escrow.',
                        status: false,
                        tl: winnerTradeLink
                    })
                } else {
                    offer.send((errSend, status) => {
                        if (errSend) {
                             self.io.emit('offer status', {
                                error: errSend,
                                status: false,
                                tl: winnerTradeLink
                            })
                        } else {
                            console.log('[!!!!!] Sent a trade to the winner of the coinflip')
                            //next line probably isnt needed
                            self.currentflips[coinflipIndex].joinable = false
                            self.removeFlipAfterTimeout(coinflipIndex, false)
                            if (status === 'pending') {
                                 self.io.emit('offer status', {
                                    error: null,
                                    status: 2,
                                    tl: winnerTradeLink
                                })
                                self.Trade.botConfirmation(Object.keys(config.bots)[0], offer.id, (errConfirm) => {
                                    if (!errConfirm) {
                                         self.io.emit('offer status', {
                                            error: null,
                                            status: 3,
                                            offer: offer.id,
                                            tl: winnerTradeLink
                                        })
                                    } else {
                                         self.io.emit('offer status', {
                                            error: errConfirm,
                                            status: false,
                                            tl: winnerTradeLink
                                        })
                                    }
                                })
                            } else {
                                 self.io.emit('offer status', {
                                    error: null,
                                    status: 3,
                                    offer: offer.id,
                                    tl: winnerTradeLink
                                })
                            }
                        }
                    })
                }
            })
        })
    })
}

FlipManager.prototype.removeFlipAfterTimeout = function removeFlipAfterTimeout(coinflipIndex, long) {
    const self = this
    setTimeout(() => {
        if(self.currentflips[coinflipIndex] && self.currentflips[coinflipIndex].joinable == false) {
            delete self.currentflips[coinflipIndex]

            if(self.currentFlipsDataForPublic && self.currentFlipsDataForPublic[coinflipIndex]) {
                delete self.currentFlipsDataForPublic[coinflipIndex]
            }

            console.log('Deleted flip ' + coinflipIndex)
            self.io.emit('flip update', {})
        }
    }, long ? 180000 : config.flipDeleteTimeout * 1000)
}

FlipManager.prototype.getFlipValueByFlipIndex = function getFlipValueByFlipIndex(index) {
    return this.currentflips[index].itemsAndDetails.value ? this.currentflips[index].itemsAndDetails.value : -1
}

FlipManager.prototype.changeFlipJoinableByFlipIndex = function changeFlipJoinableByFlipIndex(index, newVal, callback) {
    this.currentflips[index].joinable = newVal
    this.currentFlipsDataForPublic[index].joinable = newVal

    callback()
}

FlipManager.prototype.userHasFlip = function userHasFlip(sid64) {
    var hasFlip = false
    for(var i = 0; i < this.currentflips.length; i++) {
        if(typeof this.currentflips[i] === 'undefined' || typeof this.currentflips[i] === 'null' ) {
            continue
        }

        if(this.currentflips[i].flipDetails.steamID64 == sid64) {
            hasFlip = true
        }
    }
    return hasFlip
}

FlipManager.prototype.joinFlip = function joinFlip(dataPassed, itemsAndDetailsPassed) {
    this.currentPendingJoiners[dataPassed.flipId] = {
        data: dataPassed,
        itemsAndDetails: itemsAndDetailsPassed
    }
}

FlipManager.prototype.sendOwedItems = function sendOwedItems(tradelink, socket) {
    var self = this
    var i, found

    for(i = 0; i < self.winningsOwed.length && !found; i++) {
        if(self.winningsOwed[i].tl == tradelink) {
            found = true
        }
    }

    if(found) {
        if(!self.winningsOwed[i].items.length > 0) {
            socket.emit('offer status', {
                error: 'We dont owe you any items right now!',
                status: false,
            })
        } else {
            // Send items back
            var itemObjectArrayToSend = self.winningsOwed[i].items.map(assetid => ({
                assetid,
                appid: 730,
                contextid: 2,
                amount: 1
            }))

            const Bot = self.Trade.getBot(Object.keys(config.bots)[0])
            const offer = Bot.manager.createOffer(tradelink)

            offer.addMyItems(itemObjectArrayToSend)
            offer.setMessage(config.tradeMessage)

            offer.getUserDetails((detailsError, me, them) => {
                if (detailsError) {
                    console.log('Details error: ' + detailsError)

                    socket.emit('offer status', {
                        error: detailsError,
                        status: false
                    })
                } else if (me.escrowDays + them.escrowDays > 0) {
                        socket.emit('offer status', {
                        error: 'You must have 2FA enabled, we do not accept trades that go into Escrow.',
                        status: false
                    })
                } else {
                    offer.send((errSend, status) => {
                        if (errSend) {
                                socket.emit('offer status', {
                                error: errSend,
                                status: false
                            })
                        } else {
                            if (status === 'pending') {
                                    socket.emit('offer status', {
                                    error: null,
                                    status: 2
                                })
                                self.Trade.botConfirmation(Object.keys(config.bots)[0], offer.id, (errConfirm) => {
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
        }
    } else {
        socket.emit('offer status', {
            error: 'Log in first to get owed items!',
            status: false,
        })
    }
}

FlipManager.prototype.storeFlipToDB = function storeFlipToDB() {

}



module.exports = FlipManager