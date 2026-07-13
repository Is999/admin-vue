import { describe, expect, it } from 'vitest';

import {
  isMfaTicketScenarioMatch,
  isReusableMfaTicketScenario,
} from '../mfa-ticket-policy';

describe('mfa ticket policy', () => {
  it.each([0, 2, 3, 11, 12])(
    'keeps scenario %d bound to its issuing operation',
    (scenario) => {
      expect(isReusableMfaTicketScenario(scenario)).toBe(false);
    },
  );

  it.each([1, 4, 5, 6, 7, 8, 9, 10, 13, 14])(
    'allows scenario %d to share the normal operation window',
    (scenario) => {
      expect(isReusableMfaTicketScenario(scenario)).toBe(true);
    },
  );

  it('matches identical scenarios and rejects strict cross-scenario reuse', () => {
    expect(isMfaTicketScenarioMatch(11, 11)).toBe(true);
    expect(isMfaTicketScenarioMatch(4, 13)).toBe(true);
    expect(isMfaTicketScenarioMatch(4, 11)).toBe(false);
    expect(isMfaTicketScenarioMatch(11, 12)).toBe(false);
  });
});
