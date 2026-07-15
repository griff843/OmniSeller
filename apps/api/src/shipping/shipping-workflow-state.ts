export type ShipmentExecutionState =
  | 'NOT_STARTED'
  | 'PURCHASE_REQUESTED'
  | 'LABEL_PURCHASED'
  | 'SYNC_QUEUED'
  | 'FULFILLED'
  | 'VOIDED'
  | 'FAILED'
  | 'UNAVAILABLE';

export function isShippingConfigurationError(message?: string | null): boolean {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return (
    normalized.includes('easypost_api_key') ||
    normalized.includes('shipping is not configured') ||
    normalized.includes('shipping defaults are incomplete') ||
    normalized.includes('default_ship_from')
  );
}

export function deriveShipmentExecutionState(shipment: any) {
  if (!shipment) {
    return {
      status: 'NOT_STARTED' as ShipmentExecutionState,
      message: 'No shipment has been started for this order yet.',
      canVoid: false,
    };
  }

  const purchaseState = shipment.metadata?.purchase?.state ?? null;
  const voidState = shipment.metadata?.void?.state ?? null;
  const lastErrorMessage = shipment.metadata?.lastError?.message ?? null;

  if (shipment.status === 'VOIDED') {
    return {
      status: 'VOIDED' as ShipmentExecutionState,
      message: 'Shipment label was voided successfully.',
      canVoid: false,
    };
  }

  if (shipment.status === 'SYNCED_TO_MARKETPLACE') {
    return {
      status: 'FULFILLED' as ShipmentExecutionState,
      message: 'Shipment label is purchased and the marketplace fulfillment sync completed.',
      canVoid: false,
    };
  }

  if (shipment.status === 'SYNC_QUEUED') {
    return {
      status: 'SYNC_QUEUED' as ShipmentExecutionState,
      message: 'Shipment label is purchased and marketplace sync is queued.',
      canVoid: true,
    };
  }

  if (shipment.status === 'LABEL_PURCHASED') {
    return {
      status: 'LABEL_PURCHASED' as ShipmentExecutionState,
      message: 'Shipment label was purchased successfully.',
      canVoid: true,
    };
  }

  if (shipment.status === 'PENDING' || purchaseState === 'IN_PROGRESS') {
    return {
      status: 'PURCHASE_REQUESTED' as ShipmentExecutionState,
      message: 'Shipment purchase was requested and is still in progress.',
      canVoid: false,
    };
  }

  if (
    shipment.status === 'ERROR' &&
    (purchaseState === 'UNAVAILABLE' ||
      voidState === 'UNAVAILABLE' ||
      isShippingConfigurationError(lastErrorMessage))
  ) {
    return {
      status: 'UNAVAILABLE' as ShipmentExecutionState,
      message: lastErrorMessage ?? 'Shipping is unavailable in this environment.',
      canVoid: false,
    };
  }

  if (shipment.status === 'ERROR') {
    return {
      status: 'FAILED' as ShipmentExecutionState,
      message: lastErrorMessage ?? 'Shipment action failed. Review the shipment details for the latest error.',
      canVoid: false,
    };
  }

  return {
    status: 'FAILED' as ShipmentExecutionState,
    message: 'Shipment state is not recognized.',
    canVoid: false,
  };
}
