pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@statechannels/nitro-protocol/contracts/Outcome.sol";
import "@statechannels/nitro-protocol/contracts/interfaces/IForceMoveApp.sol";
import "hardhat/console.sol";

contract Scorched is IForceMoveApp {

  /**
   * Status flow
   *
   * Start at Query
   * Query -> Answer -> Validate
   * From Validate an Asker may move state to Answer (by posing a new query)
   **/

  enum AppStatus {
    Negotiate,
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

    if (toState.status == AppStatus.Answer) {
      require(fromState.status != AppStatus.Answer, "b1");
      requireAmountsUnchanged(fromState, toState);
      if (toState.queryStatus == QueryStatus.Accepted) {
        // If we accept/respond to the query we must not change the values
        // Make sure the funds have been transferred to the beneficiary pending
        // asker validation
        uint requiredAskerFunds = fromState.payment > fromState.askerBurn ? fromState.payment : fromState.askerBurn;
        require(fromAllocation[0].amount >= toAllocation[0].amount, "a0");
        require(fromAllocation[1].amount >= toAllocation[1].amount, "a1");
        require(toAllocation[2].amount >= fromAllocation[2].amount, "a2");
        require(fromAllocation[0].amount - toAllocation[0].amount == requiredAskerFunds, "a3");
        require(fromAllocation[1].amount - toAllocation[1].amount == fromState.suggesterBurn, "a4");
        require(toAllocation[2].amount - fromAllocation[2].amount == requiredAskerFunds + fromState.suggesterBurn, "a5");
      } else {
        // Query is rejected, noop
        requireBalancesUnchanged(fromAllocation, toAllocation);
      }
      return true;
    } else if (toState.status == AppStatus.Validate) {
      require(fromState.status == AppStatus.Answer && fromState.queryStatus == QueryStatus.Accepted, "b2");
      requireAmountsUnchanged(fromState, toState);
      require(toState.responseStatus != ResponseStatus.None, "b3");
      require(toState.queryStatus == QueryStatus.None, "b4");
      uint requiredAskerFunds = fromState.payment > fromState.askerBurn ? fromState.payment : fromState.askerBurn;
      if (fromState.responseStatus == ResponseStatus.Pay) {
        uint askerRefund = requiredAskerFunds - fromState.payment;
        require(toAllocation[0].amount - fromAllocation[0].amount == askerRefund, "v0");
        require(toAllocation[1].amount - fromAllocation[1].amount == fromState.payment + fromState.suggesterBurn, "v1");
        require(fromAllocation[2].amount - toAllocation[2].amount == askerRefund, "v2");
      } else if (fromState.responseStatus == ResponseStatus.Burn) {
        uint askerRefund = requiredAskerFunds - fromState.askerBurn;
        require(toAllocation[0].amount - fromAllocation[0].amount == askerRefund, "v0");
        require(toAllocation[1].amount - fromAllocation[1].amount == 0, "v1");
        require(fromAllocation[2].amount - toAllocation[2].amount == askerRefund, "v2");
      }
      return true;
    } else if (toState.status == AppStatus.Negotiate) {
      // If we have an accpted query the next state _must_ be Validate and the
      // amounts must not change
      require(fromState.status != AppStatus.Answer || fromState.queryStatus != QueryStatus.Accepted, "b5");
      require(toState.responseStatus == ResponseStatus.None, "b6");
      require(toState.queryStatus == QueryStatus.None, "b7");
      // otherwise we can renegotiate the rates
      requireBalancesUnchanged(fromAllocation, toAllocation);
      return true;
    }
    return false;
  }

  function requireStateValid(AppData memory data) internal pure {
    if (data.status == AppStatus.Answer) {
      require(data.queryStatus != QueryStatus.None, "sv0");
      require(data.responseStatus == ResponseStatus.None, "sv1");
    } else if (data.status == AppStatus.Validate) {
      require(data.queryStatus == QueryStatus.None, "sv0");
      require(data.responseStatus != ResponseStatus.None, "sv1");
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
    require(a.payment == b.payment, "au0");
    require(a.suggesterBurn == b.suggesterBurn, "au1");
    require(a.askerBurn == b.askerBurn, "au2");
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
      "Scorched: Allocation length must equal number of participants" // Suggester, Asker, Beneficiary
    );

    return allocation;
  }

  function requireDestinationsUnchanged(
    Outcome.AllocationItem[] memory from,
    Outcome.AllocationItem[] memory to
  ) private pure {
    require(to[0].destination == from[0].destination, "du0");
    require(to[1].destination == from[1].destination, "du1");
    require(to[2].destination == from[2].destination, "du2");
  }

  function requireBalancesUnchanged(
    Outcome.AllocationItem[] memory from,
    Outcome.AllocationItem[] memory to
  ) private pure {
    require(to[0].amount == from[0].amount, "bu0");
    require(to[1].amount == from[1].amount, "bu1");
    require(to[2].amount == from[2].amount, "bu2");
  }
}
