async function main() {
  const [ deployer ] = await ethers.getSigners()

  console.log(`Deploying from ${deployer.address}`)

  const Scorched = await ethers.getContractFactory('Scorched')
  const scorched = await Scorched.deploy()
  await scorched.deployed()

  const NitroAdjudicator = await ethers.getContractFactory('NitroAdjudicator')
  const adjudicator = await NitroAdjudicator.deploy()
  await adjudicator.deployed()

  const AssetHolder = await ethers.getContractFactory('MultiAssetHolder')
  const assetHolder = await AssetHolder.deploy()
  await assetHolder.deployed(adjudicator.address)

  console.log(`NitroAdjudicator address: ${adjudicator.address}`)
  console.log(`MultiAssetHolder address: ${assetHolder.address}`)
  console.log(`Scorched address: ${scorched.address}`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
