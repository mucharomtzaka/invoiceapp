export type Item = { id: string; name: string; quantity: number; unitPrice: number };
export type ReceiptDraft = {
 id?: string; receiptNumber: string; transactionType: string; transactionDate: string; transactionTime: string; businessProfileId: string;
 customerName: string; customerAddress: string; description: string; orientation: string; paperSize: string;
 items: Item[]; discountType: string; discountValue: number; dppLabel: string; taxType: string; taxValue: number;
 paymentMethod: string; paymentStatus: string; notes: string; recipientName: string; cashierName: string;
 fuelType: string; volume: number; pricePerLiter: number; vehicleNumber: string; dispenserNumber: string;
};
