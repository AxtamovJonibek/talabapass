/** Admin ro'yxati tartibi: faollar tepada, keyin to'xtatilgan, tekshiruvda, qoralama, rad etilgan, tugagan; ichida — yangisi tepada */
const ORDER = { ACTIVE: 0, PAUSED: 1, PENDING_REVIEW: 2, DRAFT: 3, REJECTED: 4, ENDED: 5 } as const;

export function startsOnOrder(a: { status: keyof typeof ORDER; createdAt: Date }, b: { status: keyof typeof ORDER; createdAt: Date }): number {
  return ORDER[a.status] - ORDER[b.status] || b.createdAt.getTime() - a.createdAt.getTime();
}
