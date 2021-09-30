const { ethers } = require('hardhat')
const assert = require('assert')

describe('Scorched', function () {
  it('Should deploy contracts', async () => {
    const Scorched = await ethers.getContractFactory('Scorched')
    const scorched = await Scorched.deploy()
    await scorched.deployed()

    const NitroAdjudicator = await ethers.getContractFactory('NitroAdjudicator')
    const adjudicator = await NitroAdjudicator.deploy()
    await adjudicator.deployed()

    const AssetHolder = await ethers.getContractFactory('MultiAssetHolder')
    const assetHolder = await AssetHolder.deploy()
    await assetHolder.deployed(adjudicator.address)
  })
})
