export enum InventoryCountStatus {
  DRAFT = 'DRAFT',
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  RECOUNT = 'RECOUNT',
}

export enum InventoryCountType {
  FULL = 'FULL',
  CATEGORY = 'CATEGORY',
  PRODUCT = 'PRODUCT',
  RACK = 'RACK',
  CYCLE = 'CYCLE',
}

export enum ApprovalAction {
  SUBMIT = 'SUBMIT',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  RECOUNT = 'RECOUNT',
}
