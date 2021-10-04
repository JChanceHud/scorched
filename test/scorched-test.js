const { ethers } = require('hardhat')
const { BigNumber } = require('ethers')
const assert = require('assert')
const {
  getChannelId,
  getFixedPart,
  getVariablePart,
  signStates,
  signState,
  convertAddressToBytes32
} = require('@statechannels/nitro-protocol')

const { AddressZero } = ethers.constants
const { defaultAbiCoder } = ethers.utils

const AppStatus = {
  Negotiate: 0,
  Answer: 1,
  Validate: 2,
}

const QueryStatus = {
  None: 0,
  Accepted: 1,
  Declined: 2,
}

const ResponseStatus = {
  None: 0,
  Pay: 1,
  Burn: 2,
}

function encodeAppData(data) {
  return ethers.utils.defaultAbiCoder.encode(
    [
      'tuple(uint256 payment, uint256 suggesterBurn, uint256 askerBurn, uint8 status, uint8 queryStatus, uint8 responseStatus)',
    ],
    [data]
  )
}

function createOutcome(contracts, wallets, balances) {
  const { adjudicator } = contracts
  const { asker, suggester, beneficiary } = wallets
  const allocation = [
    {
      destination: convertAddressToBytes32(asker.address),
      amount: balances.asker.toString(),
    },
    {
      destination: convertAddressToBytes32(suggester.address),
      amount: balances.suggester.toString(),
    },
    {
      destination: convertAddressToBytes32(beneficiary.address),
      amount: balances.beneficiary.toString(),
    },
  ]
  // console.log(Object.keys(wallets).map(w => `${w}: ${wallets[w].address}`))
  // console.log(allocation)
  return [
    {
      asset: '0x0000000000000000000000000000000000000000',
      assetHolderAddress: adjudicator.address,
      allocationItems: allocation
    }
  ]
}

async function getDeployedContracts() {
  const NitroAdjudicator = await ethers.getContractFactory('NitroAdjudicator')
  const adjudicator = await NitroAdjudicator.deploy()
  await adjudicator.deployed()

  const Scorched = await ethers.getContractFactory('Scorched')
  const scorched = await Scorched.deploy(adjudicator.address)
  await scorched.deployed()

  return { scorched, adjudicator }
}

describe('Scorched', function () {
  it('should query and respond', async () => {
    const { scorched, adjudicator } = await getDeployedContracts()
    const [ sender, asker, suggester, beneficiary ] = await ethers.getSigners()

    const wallets = [
      ethers.Wallet.createRandom(),
      ethers.Wallet.createRandom(),
    ]

    const channel = {
      chainId: '0x1234',
      channelNonce: BigNumber.from(0).toHexString(),
      participants: wallets.map(w => w.address),
    }
    const channelId = getChannelId(channel)
    const startingOutcome = createOutcome(
      { adjudicator },
      { asker, suggester, beneficiary, },
      {
        asker: 10,
        suggester: 10,
        beneficiary: 0,
      }
    )

    const baseState = {
      isFinal: false,
      channel,
      outcome: startingOutcome,
      appDefinition: scorched.address,
      appData: ethers.constants.HashZero,
      challengeDuration: 1,
    }

    const state0 = {
      ...baseState,
      turnNum: 0,
    }

    const state1 = {
      ...baseState,
      turnNum: 1,
    }

    const whoSignedWhat = [0,1]
    const preFundSigs = await signStates([state0, state1], wallets, whoSignedWhat)

    const preFundCheckpointTx = await adjudicator.connect(sender).checkpoint(
      getFixedPart(state1),
      state1.turnNum,
      [getVariablePart(state0), getVariablePart(state1)],
      0,
      preFundSigs,
      whoSignedWhat
    )
    await preFundCheckpointTx.wait()

    // Run deposits
    {
      const depositAmount = '100000000'

      const suggesterDepositTx = await adjudicator.connect(suggester).deposit(
        '0x0000000000000000000000000000000000000000',
        channelId,
        0,
        depositAmount,
        {
          value: depositAmount.toString()
        }
      )
      await suggesterDepositTx.wait()

      const askerDepositTx = await adjudicator.connect(asker).deposit(
        '0x0000000000000000000000000000000000000000',
        channelId,
        depositAmount,
        depositAmount,
        {
          value: depositAmount.toString()
        }
      )
      await askerDepositTx.wait()
    }

    // Contract is funded, post fund checkpoint

    const state2 = {
      ...baseState,
      turnNum: 2,
    }

    const state3 = {
      ...baseState,
      turnNum: 3,
    }

    const postFundSigs = await signStates([state2, state3], wallets, [0, 1])

    const postFundCheckpointTx = await adjudicator.connect(sender).checkpoint(
      getFixedPart(state3),
      state3.turnNum,
      [getVariablePart(state2), getVariablePart(state3)],
      0,
      postFundSigs,
      [0, 1]
    )
    await postFundCheckpointTx.wait()

    const fromAppData = {
      payment: BigNumber.from(6).toString(),
      askerBurn: BigNumber.from(3).toString(),
      suggesterBurn: BigNumber.from(3).toString(),
      status: AppStatus.Answer,
      queryStatus: QueryStatus.Accepted,
      responseStatus: ResponseStatus.None,
    }
    const fromAppDataBytes = encodeAppData(fromAppData)

    const state4 = {
      ...baseState,
      outcome: createOutcome(
        { adjudicator },
        { asker, suggester, beneficiary, },
        {
          asker: 4,
          suggester: 7,
          beneficiary: 9,
        }
      ),
      appData: fromAppDataBytes,
      turnNum: 4,
    }

    const toAppData = {
      payment: BigNumber.from(6).toString(),
      askerBurn: BigNumber.from(3).toString(),
      suggesterBurn: BigNumber.from(3).toString(),
      status: AppStatus.Validate,
      queryStatus: QueryStatus.None,
      responseStatus: ResponseStatus.Pay,
    }
    const toAppDataBytes = encodeAppData(toAppData)

    const state5 = {
      ...baseState,
      outcome: createOutcome(
        { adjudicator },
        { asker, suggester, beneficiary, },
        {
          asker: 4,
          suggester: 16,
          beneficiary: 0,
        }
      ),
      appData: toAppDataBytes,
      turnNum: 5,
    }
    const querySigs = await signStates([state4, state5], wallets, [0, 1])
    const queryCheckpointTx = await adjudicator.connect(sender).checkpoint(
      getFixedPart(state5),
      state5.turnNum,
      [getVariablePart(state4), getVariablePart(state5)],
      0,
      querySigs,
      [0, 1]
    )
    await queryCheckpointTx.wait()
  })

  it('should run multiple interactions without l1', async () => {
    const { scorched, adjudicator } = await getDeployedContracts()
    const [ sender, asker, suggester, beneficiary ] = await ethers.getSigners()

    const depositAmount = '100000000'

    const wallets = [
      ethers.Wallet.createRandom(),
      ethers.Wallet.createRandom(),
    ]

    const channel = {
      chainId: '0x1234',
      channelNonce: BigNumber.from(0).toHexString(),
      participants: wallets.map(w => w.address),
    }
    const channelId = getChannelId(channel)
    const startingOutcome = createOutcome(
      { adjudicator },
      { asker, suggester, beneficiary, },
      {
        asker: depositAmount.toString(),
        suggester: depositAmount.toString(),
        beneficiary: 0,
      }
    )

    const baseState = {
      isFinal: false,
      channel,
      outcome: startingOutcome,
      appDefinition: scorched.address,
      appData: ethers.constants.HashZero,
      challengeDuration: 1,
    }

    const state0 = {
      ...baseState,
      turnNum: 0,
    }

    const state1 = {
      ...baseState,
      turnNum: 1,
    }

    const preFundSigs = await signStates([state0, state1], wallets, [0, 1])

    const preFundCheckpointTx = await adjudicator.connect(sender).checkpoint(
      getFixedPart(state1),
      state1.turnNum,
      [getVariablePart(state0), getVariablePart(state1)],
      0,
      preFundSigs,
      [0, 1]
    )
    await preFundCheckpointTx.wait()

    // Run deposits
    {

      const suggesterDepositTx = await adjudicator.connect(suggester).deposit(
        '0x0000000000000000000000000000000000000000',
        channelId,
        0,
        depositAmount,
        {
          value: depositAmount.toString()
        }
      )
      await suggesterDepositTx.wait()

      const askerDepositTx = await adjudicator.connect(asker).deposit(
        '0x0000000000000000000000000000000000000000',
        channelId,
        depositAmount,
        depositAmount,
        {
          value: depositAmount.toString()
        }
      )
      await askerDepositTx.wait()
    }

    // Contract is funded, post fund checkpoint

    const state2 = {
      ...baseState,
      turnNum: 2,
    }

    const state3 = {
      ...baseState,
      turnNum: 3,
    }

    const postFundSigs = await signStates([state2, state3], wallets, [0, 1])

    const postFundCheckpointTx = await adjudicator.connect(sender).checkpoint(
      getFixedPart(state3),
      state3.turnNum,
      [getVariablePart(state2), getVariablePart(state3)],
      0,
      postFundSigs,
      [0, 1]
    )
    await postFundCheckpointTx.wait()

    const startTurn = 4
    const balances = {
      asker: +depositAmount.toString(),
      suggester: +depositAmount.toString(),
      beneficiary: 0,
    }
    const sigs = []
    const states = []
    for (let x = 0; x < 20; x++) {
      let appData
      if (x % 2 === 0) {
        // suggester is responding
        appData = {
          payment: BigNumber.from(6).toString(),
          askerBurn: BigNumber.from(3).toString(),
          suggesterBurn: BigNumber.from(3).toString(),
          status: AppStatus.Answer,
          queryStatus: QueryStatus.Accepted,
          responseStatus: ResponseStatus.None,
        }
        balances.asker -= 6
        balances.suggester -= 3
        balances.beneficiary += 9
      } else {
        // asker is responding
        appData = {
          payment: BigNumber.from(6).toString(),
          askerBurn: BigNumber.from(3).toString(),
          suggesterBurn: BigNumber.from(3).toString(),
          status: AppStatus.Validate,
          queryStatus: QueryStatus.None,
          responseStatus: ResponseStatus.Pay,
        }
        balances.asker -= 0
        balances.suggester += 9
        balances.beneficiary -= 9
      }
      const appDataBytes = encodeAppData(appData)
      const nextState = {
        ...baseState,
        outcome: createOutcome(
          { adjudicator, },
          { asker, suggester, beneficiary, },
          balances,
        ),
        appData: appDataBytes,
        turnNum: startTurn + x
      }
      const sig = await signState(nextState, wallets[x % 2].privateKey)
      sigs.push(sig)
      states.push(nextState)
    }

    // create a checkpoint after 20 rounds
    const lastTwoSigs = sigs.slice(-2)
    const latestState = sigs[sigs.length - 1].state
    const lastTwoStates = states.slice(-2)
    const checkpointTx = await adjudicator.connect(sender).checkpoint(
      getFixedPart(latestState),
      latestState.turnNum,
      lastTwoSigs.map(s => getVariablePart(s.state)),
      0,
      lastTwoSigs.map((s) => s.signature),
      [0, 1]
    )
    await checkpointTx.wait()
  })

  it('should negotiate a new rate', async () => {
    const { scorched, adjudicator } = await getDeployedContracts()
    const [ sender, asker, suggester, beneficiary ] = await ethers.getSigners()

    const depositAmount = '100000000'

    const wallets = [
      ethers.Wallet.createRandom(),
      ethers.Wallet.createRandom(),
    ]

    const channel = {
      chainId: '0x1234',
      channelNonce: BigNumber.from(0).toHexString(),
      participants: wallets.map(w => w.address),
    }
    const channelId = getChannelId(channel)
    const startingOutcome = createOutcome(
      { adjudicator },
      { asker, suggester, beneficiary, },
      {
        asker: depositAmount.toString(),
        suggester: depositAmount.toString(),
        beneficiary: 0,
      }
    )

    const baseState = {
      isFinal: false,
      channel,
      outcome: startingOutcome,
      appDefinition: scorched.address,
      appData: ethers.constants.HashZero,
      challengeDuration: 1,
    }

    const state0 = {
      ...baseState,
      turnNum: 0,
    }

    const state1 = {
      ...baseState,
      turnNum: 1,
    }

    const preFundSigs = await signStates([state0, state1], wallets, [0, 1])

    const preFundCheckpointTx = await adjudicator.connect(sender).checkpoint(
      getFixedPart(state1),
      state1.turnNum,
      [getVariablePart(state0), getVariablePart(state1)],
      0,
      preFundSigs,
      [0, 1]
    )
    await preFundCheckpointTx.wait()

    // Run deposits
    {

      const suggesterDepositTx = await adjudicator.connect(suggester).deposit(
        '0x0000000000000000000000000000000000000000',
        channelId,
        0,
        depositAmount,
        {
          value: depositAmount.toString()
        }
      )
      await suggesterDepositTx.wait()

      const askerDepositTx = await adjudicator.connect(asker).deposit(
        '0x0000000000000000000000000000000000000000',
        channelId,
        depositAmount,
        depositAmount,
        {
          value: depositAmount.toString()
        }
      )
      await askerDepositTx.wait()
    }

    // Contract is funded, post fund checkpoint

    const state2 = {
      ...baseState,
      turnNum: 2,
    }

    const state3 = {
      ...baseState,
      turnNum: 3,
    }

    const postFundSigs = await signStates([state2, state3], wallets, [0, 1])

    const postFundCheckpointTx = await adjudicator.connect(sender).checkpoint(
      getFixedPart(state3),
      state3.turnNum,
      [getVariablePart(state2), getVariablePart(state3)],
      0,
      postFundSigs,
      [0, 1]
    )
    await postFundCheckpointTx.wait()
    const balances = {
      asker: +depositAmount.toString(),
      suggester: +depositAmount.toString(),
      beneficiary: 0,
    }

    const appData = {
      payment: BigNumber.from(10).toString(),
      askerBurn: BigNumber.from(3).toString(),
      suggesterBurn: BigNumber.from(3).toString(),
      status: AppStatus.Negotiate,
      queryStatus: QueryStatus.None,
      responseStatus: ResponseStatus.None,
    }
    const state4 = {
      ...baseState,
      turnNum: 4,
      outcome: createOutcome(
        { adjudicator, },
        { asker, suggester, beneficiary },
        balances,
      ),
      appData: encodeAppData(appData),
    }
    const state5 = {
      ...state4,
      turnNum: 5,
      appData: encodeAppData({
        ...appData,
        payment: BigNumber.from(20).toString(),
        askerBurn: BigNumber.from(6).toString(),
        suggesterBurn: BigNumber.from(6).toString(),
      })
    }
    const sig1 = await signState(state4, wallets[0].privateKey)
    const sig2 = await signState(state5, wallets[1].privateKey)
    const tx = await adjudicator.connect(sender).checkpoint(
      getFixedPart(state5),
      state5.turnNum,
      [getVariablePart(sig1.state), getVariablePart(sig2.state)],
      0,
      [sig1.signature, sig2.signature],
      [0, 1]
    )
    await tx.wait()

    const acceptAppData = {
      payment: BigNumber.from(20).toString(),
      askerBurn: BigNumber.from(6).toString(),
      suggesterBurn: BigNumber.from(6).toString(),
      status: AppStatus.Answer,
      queryStatus: QueryStatus.Accepted,
      responseStatus: ResponseStatus.None,
    }
    const state6 = {
      ...baseState,
      turnNum: 6,
      appData: encodeAppData(acceptAppData),
      outcome: createOutcome(
        { adjudicator, },
        { asker, suggester, beneficiary },
        {
          asker: BigNumber.from(depositAmount).sub(acceptAppData.payment).toString(),
          suggester: BigNumber.from(depositAmount).sub(acceptAppData.suggesterBurn).toString(),
          beneficiary: BigNumber.from(26).toString(),
        },
      ),
    }
    const acceptSig = await signState(state6, wallets[0].privateKey)
    const acceptTx = await adjudicator.connect(sender).checkpoint(
      getFixedPart(state6),
      state6.turnNum,
      [getVariablePart(sig2.state), getVariablePart(acceptSig.state)],
      0,
      [sig2.signature, acceptSig.signature],
      [1, 0],
    )
    await acceptTx.wait()
  })
})
