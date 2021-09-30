pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@statechannels/nitro-protocol/contracts/Outcome.sol";
import "@statechannels/nitro-protocol/contracts/interfaces/IForceMoveApp.sol";

contract Scorched is IForceMoveApp {

  /**
   * Status flow
   *
   * Start at Query
   * Query -> Answer -> Validate
   * From Validate an Asker may move state to Answer (by posing a new query)
   **/

  enum AppStatus {
    Answer, // Suggester either responds or declines to respond
    Validate // If suggester responds asker may burn or pay
  }

  enum QueryStatus {
    None,
    Accepted,
    Declined
  }

  enum ResponseStatus {
    None,
    Pay,
    Burn
  }

  struct AppData {
    uint payment;
    uint suggesterBurn;
    uint askerBurn;
    AppStatus status;
    QueryStatus queryStatus;
    ResponseStatus responseStatus;
  }

  function appData(bytes memory appDataBytes) internal pure returns (AppData memory) {
    return abi.decode(appDataBytes, (AppData));
  }

  function validTransition(
    VariablePart memory a,
    VariablePart memory b,
    uint48 turnNumB,
    uint256 nParticipants
  ) public pure override returns (bool) {
    Outcome.AllocationItem[] memory fromAllocation = extractAllocation(a);
    Outcome.AllocationItem[] memory toAllocation = extractAllocation(b);

    requireDestinationsUnchanged(fromAllocation, toAllocation);

    AppData memory fromState = appData(a.appData);
    AppData memory toState = appData(b.appData);

    requireStateValid(fromState);
    requireStateValid(toState);

    if (fromState.status == AppStatus.Answer) {
      if (toState.queryStatus == QueryStatus.Accepted) {
        // If we accept/respond to the query we must not change the values
        requireAmountsUnchanged(fromState, toState);
      }
      return true;
    } else if (fromState.status == AppStatus.Validate) {
      require(toState.status == AppStatus.Answer);
      return true;
    }
    return false;
  }

  function requireStateValid(AppData memory data) internal pure {
    if (data.status == AppStatus.Answer) {
      require(data.queryStatus != QueryStatus.None);
      require(data.responseStatus == ResponseStatus.None);
    } else if (data.status == AppStatus.Validate) {
      require(data.queryStatus == QueryStatus.None);
      require(data.responseStatus != ResponseStatus.None);
    }
  }

  function requireResponseValid(AppData memory a, AppData memory b) internal pure {
    // if (fromState.state == AppState.Query) {
    //   require(b.response == Response.None);
    // } else if (fromState.state == AppState.Decide) {
    //   require(b.response == Response.None);
    // } else if (fromState.state == AppState.)
  }

  function requireAmountsUnchanged(AppData memory a, AppData memory b) internal pure {
    require(a.payment == b.payment);
    require(a.suggesterBurn == b.suggesterBurn);
    require(a.askerBurn == b.askerBurn);
  }

  function extractAllocation(VariablePart memory variablePart)
    private
    pure
    returns (Outcome.AllocationItem[] memory)
  {
    Outcome.OutcomeItem[] memory outcome = abi.decode(
      variablePart.outcome,
      (Outcome.OutcomeItem[])
    );
    require(outcome.length == 1, "Scorched: Only one asset allowed");

    Outcome.AssetOutcome memory assetOutcome = abi.decode(
      outcome[0].assetOutcomeBytes,
      (Outcome.AssetOutcome)
    );
    require(
      assetOutcome.assetOutcomeType == Outcome.AssetOutcomeType.Allocation,
      "Scorched: AssetOutcomeType must be Allocation"
    );

    Outcome.AllocationItem[] memory allocation = abi.decode(
      assetOutcome.allocationOrGuaranteeBytes,
      (Outcome.AllocationItem[])
    );

    require(
      allocation.length == 3,
      'Scorched: Allocation length must equal number of participants' // Suggester, Asker, Beneficiary
    );

    return allocation;
  }

  function requireDestinationsUnchanged(
    Outcome.AllocationItem[] memory from,
    Outcome.AllocationItem[] memory to
  ) private pure {
    require(to[0].destination == from[0].destination);
    require(to[1].destination == from[1].destination);
    require(to[2].destination == from[2].destination);
  }
}
