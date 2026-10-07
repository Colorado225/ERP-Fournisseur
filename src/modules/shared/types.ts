// ============================================================================
// IVOIREAPPRO ERP — TYPES STRICTS DU DOMAINE MÉTIER
// ============================================================================

export enum RoleName {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  LOGISTICS = 'LOGISTICS',
  WAREHOUSE = 'WAREHOUSE',
  ACCOUNTING = 'ACCOUNTING',
  VIEWER = 'VIEWER',
}

export enum ContractStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum UnitCode {
  KG = 'KG',
  TON = 'TON',
  LITER = 'LITER',
  UNIT = 'UNIT',
  SACK = 'SACK',
  CARTON = 'CARTON',
  BAG = 'BAG',
  BOX = 'BOX',
}

export enum StockMovementType {
  PURCHASE = 'PURCHASE',
  RECEIPT = 'RECEIPT',
  DELIVERY = 'DELIVERY',
  RETURN = 'RETURN',
  ADJUSTMENT = 'ADJUSTMENT',
  LOSS = 'LOSS',
  DAMAGE = 'DAMAGE',
  TRANSFER = 'TRANSFER',
}

export enum DeliveryStatus {
  DRAFT = 'DRAFT',
  PLANNED = 'PLANNED',
  PREPARING = 'PREPARING',
  READY = 'READY',
  DISPATCHED = 'DISPATCHED',
  PARTIALLY_RECEIVED = 'PARTIALLY_RECEIVED',
  RECEIVED = 'RECEIVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  CLOSED = 'CLOSED',
}

export enum DocumentType {
  CONTRACT = 'CONTRACT',
  PURCHASE_ORDER = 'PURCHASE_ORDER',
  DELIVERY_NOTE = 'DELIVERY_NOTE',
  RECEIPT = 'RECEIPT',
  INVOICE = 'INVOICE',
  PAYMENT_PROOF = 'PAYMENT_PROOF',
  SUPPLIER_DOCUMENT = 'SUPPLIER_DOCUMENT',
  QUALITY_DOCUMENT = 'QUALITY_DOCUMENT',
  REPORT = 'REPORT',
  OTHER = 'OTHER',
}

export enum DocumentStatus {
  DRAFT = 'DRAFT',
  PREVIEW = 'PREVIEW',
  FINAL = 'FINAL',
  ARCHIVED = 'ARCHIVED',
  SUPERSEDED = 'SUPERSEDED',
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
  DISPUTED = 'DISPUTED',
}

export enum TaxCertificationStatus {
  NOT_SUBMITTED = 'NOT_SUBMITTED',
  SUBMITTED = 'SUBMITTED',
  CERTIFIED = 'CERTIFIED',
  REJECTED = 'REJECTED',
}

export enum ExpenseCategoryType {
  TRANSPORT = 'TRANSPORT',
  FUEL = 'FUEL',
  HANDLING = 'HANDLING',
  STORAGE = 'STORAGE',
  PURCHASE = 'PURCHASE',
  MAINTENANCE = 'MAINTENANCE',
  ADMIN = 'ADMIN',
  BANK_FEES = 'BANK_FEES',
  OTHER = 'OTHER',
}

export enum AuditActionType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  VALIDATE = 'VALIDATE',
  CANCEL = 'CANCEL',
  EXPORT = 'EXPORT',
  LOGIN = 'LOGIN',
  DOCUMENT_GENERATED = 'DOCUMENT_GENERATED',
  DOCUMENT_FINALIZED = 'DOCUMENT_FINALIZED',
  PAYMENT_RECORDED = 'PAYMENT_RECORDED',
}

export enum RuleCategory {
  INTERNAL = 'INTERNAL',           // Règle métier interne
  CONTRACTUAL = 'CONTRACTUAL',     // Règle contractuelle
  ADMINISTRATIVE = 'ADMINISTRATIVE', // Règle administrative configurable
  FISCAL = 'FISCAL',               // Règle fiscale configurable
  DOCUMENTARY = 'DOCUMENTARY',     // Règle documentaire configurable
}

export interface Organization {
  id: string;
  legalName: string;
  tradeName: string;
  taxId: string;
  registrationNumber: string;
  address: string;
  phone: string;
  email: string;
  currency: string;
}

export interface UserProfile {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  phone: string;
  role: RoleName;
  roleLabel: string;
  permissions: string[];
  isActive: boolean;
  lastLoginAt: string;
}

export interface CustomerDestination {
  id: string;
  customerId: string;
  siteName: string;
  city: string;
  addressLine: string;
  receivingHours: string;
  requiredDocTypes: string[];
  contactPerson: string;
  contactPhone: string;
}

export interface Customer {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  category: string;
  taxIdentifier: string;
  paymentTermsDays: number;
  primaryContactName: string;
  primaryContactRole: string;
  primaryContactPhone: string;
  primaryContactEmail: string;
  destinations: CustomerDestination[];
}

export interface Product {
  id: string;
  organizationId: string;
  reference: string;
  internalCode: string;
  name: string;
  categoryName: string;
  unit: UnitCode;
  weightKg: number;
  packaging: string;
  conversionToKg: number; // Règle explicite enregistrée : ex 1 SAC = 50 KG
  conversionRuleLabel: string;
  standardCost: number;
  minStockThreshold: number;
  isActive: boolean;
}

export interface ContractLine {
  id: string;
  contractId: string;
  productId: string;
  unit: UnitCode;
  quantity: number;      // Quantité contractuelle autorisée
  unitPrice: number;     // Prix unitaire HT contractuel (FCFA)
  taxRate: number;       // Taux de taxe configurable (%)
  totalAmount: number;
}

export interface Contract {
  id: string;
  organizationId: string;
  reference: string;
  title: string;
  customerId: string;
  startDate: string;
  endDate: string;
  status: ContractStatus;
  currency: string;
  totalAmount: number;
  notes: string;
  lines: ContractLine[];
}

export interface CustomerOrder {
  id: string;
  organizationId: string;
  reference: string;
  contractId: string;
  destinationId: string;
  orderDate: string;
  requestedDate: string;
  status: 'CONFIRMED' | 'IN_PROGRESS' | 'FULFILLED' | 'CANCELLED';
  totalAmount: number;
  notes: string;
}

export interface DeliveryLine {
  id: string;
  deliveryId: string;
  contractLineId: string;
  productId: string;
  lotNumber: string;
  unit: UnitCode;
  quantityPlanned: number;
  quantityDelivered: number;
  quantityAccepted: number;
  quantityRejected: number;
  unitPrice: number;
  rejectionReason?: string;
  observation?: string;
}

export interface DeliveryStatusHistoryEntry {
  id: string;
  status: DeliveryStatus;
  changedBy: string;
  comment: string;
  changedAt: string;
}

export interface Delivery {
  id: string;
  organizationId: string;
  reference: string;
  contractId: string;
  orderId: string;
  destinationId: string;
  plannedDate: string;
  actualDate?: string;
  status: DeliveryStatus;
  driverName: string;
  vehiclePlate: string;
  responsibleUser: string;
  overrideReason?: string;
  notes: string;
  lines: DeliveryLine[];
  statusHistory: DeliveryStatusHistoryEntry[];
}

export interface Warehouse {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  location: string;
  managerName: string;
}

export interface StockLot {
  id: string;
  warehouseId: string;
  productId: string;
  lotNumber: string;
  receivedDate: string;
  expiryDate: string;
  unitCost: number;
  initialQuantity: number;
  reservedQuantity: number;
}

export interface StockMovement {
  id: string;
  organizationId: string;
  warehouseId: string;
  productId: string;
  lotId: string;
  lotNumber: string;
  type: StockMovementType;
  quantityDelta: number; // + entrée, - sortie
  referenceDoc: string;
  reason: string;
  performedBy: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  specialty: string;
  phone: string;
  email: string;
  city: string;
}

export interface PurchaseOrder {
  id: string;
  organizationId: string;
  reference: string;
  supplierId: string;
  productId: string;
  quantity: number;
  unitCost: number;
  totalAmount: number;
  orderDate: string;
  expectedDate: string;
  status: 'ORDERED' | 'RECEIVED' | 'PAID';
}

export interface DocumentTemplate {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  type: DocumentType;
  version: string;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  effectiveFrom: string;
  effectiveTo?: string;
  requiredSignatures: string[];
  footerNotice: string;
}

export interface StoredDocument {
  id: string;
  organizationId: string;
  entityType: 'CONTRACT' | 'DELIVERY' | 'INVOICE' | 'CUSTOMER' | 'SUPPLIER';
  entityId: string;
  entityReference: string;
  documentType: DocumentType;
  title: string;
  fileName: string;
  mimeType: string;
  version: number;
  status: DocumentStatus;
  templateVersion: string;
  checksum: string;
  uploadedBy: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  organizationId: string;
  reference: string;
  customerId: string;
  contractId: string;
  deliveryId?: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  taxCertificationStatus: TaxCertificationStatus;
  taxCertificationRef?: string;
  notes: string;
}

export interface Payment {
  id: string;
  organizationId: string;
  reference: string;
  invoiceId: string;
  customerId: string;
  paymentDate: string;
  amount: number;
  method: 'VIREMENT_TRESOR' | 'VIREMENT_BANCAIRE' | 'CHEQUE_CERTIFIE' | 'TRAITE';
  bankReference: string;
  recordedBy: string;
}

export interface Expense {
  id: string;
  organizationId: string;
  reference: string;
  category: ExpenseCategoryType;
  label: string;
  amount: number;
  expenseDate: string;
  contractId?: string;
  deliveryId?: string;
  supplierId?: string;
  productId?: string;
  status: 'PAID' | 'PENDING';
  recordedBy: string;
}

export interface ConfigurableRule {
  id: string;
  code: string;
  title: string;
  category: RuleCategory;
  value: string;
  description: string;
  isEditable: boolean;
}

export interface AuditLogEntry {
  id: string;
  organizationId: string;
  userId: string;
  userName: string;
  userRole: RoleName;
  action: AuditActionType;
  entity: string;
  entityId: string;
  summary: string;
  oldValue?: string;
  newValue?: string;
  ipAddress: string;
  createdAt: string;
}

export interface ErpState {
  organization: Organization;
  currentUserId: string;
  users: UserProfile[];
  customers: Customer[];
  products: Product[];
  contracts: Contract[];
  orders: CustomerOrder[];
  deliveries: Delivery[];
  warehouses: Warehouse[];
  stockLots: StockLot[];
  stockMovements: StockMovement[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  documentTemplates: DocumentTemplate[];
  documents: StoredDocument[];
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
  configurableRules: ConfigurableRule[];
  auditLogs: AuditLogEntry[];
  sequences: Record<string, number>;
}
