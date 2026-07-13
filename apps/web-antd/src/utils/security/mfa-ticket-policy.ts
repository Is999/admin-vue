// STRICT_MFA_TICKET_SCENARIOS 保存必须绑定原场景使用的 MFA 二次票据场景，与后端安全策略一致。
const STRICT_MFA_TICKET_SCENARIOS = new Set([0, 2, 3, 11, 12]);

// isReusableMfaTicketScenario 判断指定场景是否允许跨场景复用最近一次 MFA 二次票据。
export function isReusableMfaTicketScenario(scenario: number) {
  return scenario > 0 && !STRICT_MFA_TICKET_SCENARIOS.has(scenario);
}

// isMfaTicketScenarioMatch 判断当前请求场景是否可以使用指定签发场景的缓存票据。
export function isMfaTicketScenarioMatch(
  expectScenario: number,
  ticketScenario: number,
) {
  if (expectScenario === ticketScenario) {
    return true;
  }
  return (
    isReusableMfaTicketScenario(expectScenario) &&
    isReusableMfaTicketScenario(ticketScenario)
  );
}
