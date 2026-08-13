export const POLICY = {
  GREEN: "green",
  YELLOW: "yellow",
  RED: "red"
}

export function classifyAction(action) {
  const type = action?.type ?? "unknown"

  if ([
    "read_item",
    "summarize",
    "rank_items",
    "extract_table",
    "save_memory"
  ].includes(type)) {
    return POLICY.GREEN
  }

  if ([
    "send_message",
    "forward_file",
    "create_calendar_event",
    "edit_task",
    "bulk_update"
  ].includes(type)) {
    return POLICY.YELLOW
  }

  if ([
    "payment",
    "delete_data",
    "public_post",
    "send_sensitive_file",
    "account_security_change"
  ].includes(type)) {
    return POLICY.RED
  }

  return POLICY.YELLOW
}

export function buildApprovalEnvelope(action) {
  const level = classifyAction(action)
  return {
    level,
    requiresApproval: level !== POLICY.GREEN,
    action
  }
}

