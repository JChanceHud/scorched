async function main() {
  const [ deployer ] = await ethers.getSigners()

  console.log(`Deploying from ${deployer.address}`)

  const NitroAdjudicator = await ethers.getContractFactory('NitroAdjudicator')
  const adjudicator = await NitroAdjudicator.deploy()
  await adjudicator.deployed()

  const Scorched = await ethers.getContractFactory('Scorched')
  const scorched = await Scorched.deploy(adjudicator.address)
  await scorched.deployed()

  console.log(`NitroAdjudicator address: ${adjudicator.address}`)
  console.log(`Scorched address: ${scorched.address}`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
