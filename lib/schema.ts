import { z } from 'zod';

export const DogSizeEnum = z.enum(['SMALL', 'MEDIUM', 'LARGE', 'XLARGE']);
export type DogSizeEnum = z.infer<typeof DogSizeEnum>;

export const BookingStatusEnum = z.enum([
  'PENDING',
  'CONFIRMED',
  'CANCELLED',
  'COMPLETED',
  'NO_SHOW',
]);
export type BookingStatusEnum = z.infer<typeof BookingStatusEnum>;

const phoneRegex = /^(\+?[0-9\s\-().]{6,20})$/;

export const AnimalTypeEnum = z.enum(['DOG', 'CAT']);
export type AnimalTypeEnum = z.infer<typeof AnimalTypeEnum>;

export const BookingInputSchema = z.object({
  serviceId: z.string().min(1, 'Seleziona un servizio'),
  addonServiceIds: z.array(z.string().min(1)).max(20).optional(),
  sizeOptionId: z.string().min(1).optional(),
  animalType: AnimalTypeEnum,
  dogBreed: z.string().min(1, 'Seleziona la razza').max(80),
  // ISO datetime in Europe/Rome — server re-validates against opening hours
  startsAt: z
    .string()
    .min(1)
    .refine((s) => !Number.isNaN(Date.parse(s)), 'Data/ora non valida'),
  customerName: z
    .string()
    .min(2, 'Nome troppo corto')
    .max(80, 'Nome troppo lungo'),
  customerEmail: z.union([z.string().email().max(120), z.literal('')]).optional(),
  customerPhone: z
    .string()
    .regex(phoneRegex, 'Telefono non valido')
    .max(30),
  dogName: z.string().max(50).optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
  coatChoice: z.enum(['SHORT', 'LONG']).optional(),
  privacyConsent: z.literal(true, {
    errorMap: () => ({ message: 'Devi accettare la privacy policy' }),
  }),
});

export type BookingInput = z.infer<typeof BookingInputSchema>;

export const ServiceSelectionSchema = z.object({
  serviceId: z.string().min(1),
});

export const SlotQuerySchema = z.object({
  serviceId: z.string().min(1),
  // Comma-separated list of addon service ids (e.g. "id1,id2"); optional.
  addonServiceIds: z.string().optional(),
  // YYYY-MM-DD
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida'),
  // Optional context for per-cell duration override (BreedServicePrice)
  breedName: z.string().max(80).optional(),
  sizeOptionId: z.string().max(40).optional(),
  coatChoice: z.enum(['SHORT', 'LONG']).optional(),
});

export type SlotQuery = z.infer<typeof SlotQuerySchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const StaffCreateSchema = z.object({
  email: z.string().email('Email non valida').max(120),
  name: z.string().min(2, 'Nome troppo corto').max(80),
});
export type StaffCreateInput = z.infer<typeof StaffCreateSchema>;

export const ServiceAdminSchema = z.object({
  name: z.string().min(2).max(100),
  displayName: z.string().max(100).nullable().optional(),
  description: z.string().max(500).optional().or(z.literal('')),
  durationMin: z.coerce.number().int().min(15).max(480),
  bufferMin: z.coerce.number().int().min(0).max(120).default(0),
  priceCents: z.coerce.number().int().min(0).max(100000),
  pricingMode: z.enum(['FIXED', 'PER_BREED']).default('FIXED'),
  breedScope: z.enum(['ALL', 'SELECTED']).default('ALL'),
  isDefault: z.boolean().default(false),
  priceCoatShortMinCents: z.coerce.number().int().min(0).max(100000).nullable().optional(),
  priceCoatShortMaxCents: z.coerce.number().int().min(0).max(100000).nullable().optional(),
  priceCoatLongMinCents:  z.coerce.number().int().min(0).max(100000).nullable().optional(),
  priceCoatLongMaxCents:  z.coerce.number().int().min(0).max(100000).nullable().optional(),
  size: DogSizeEnum.optional(),
  forAnimal: AnimalTypeEnum.nullable().optional(),
  active: z.boolean().default(true),
  // sortOrder is managed via moveServiceAction, not via the upsert form.
});

export const ClosureSchema = z
  .object({
    startsAt: z.string().min(1),
    endsAt: z.string().min(1),
    reason: z.string().max(200).optional().or(z.literal('')),
  })
  .refine((d) => Date.parse(d.endsAt) > Date.parse(d.startsAt), {
    message: 'La fine deve essere successiva all’inizio',
    path: ['endsAt'],
  });

export const BookingStatusUpdateSchema = z.object({
  bookingId: z.string().min(1),
  status: BookingStatusEnum,
});

export const AdminBookingInputSchema = z.object({
  serviceId: z.string().min(1, 'Seleziona un servizio'),
  addonServiceIds: z.array(z.string().min(1)).max(20).optional(),
  sizeOptionId: z.string().min(1).optional(),
  animalType: AnimalTypeEnum,
  dogBreed: z.string().max(80).optional().or(z.literal('')),
  startsAt: z.string().min(1).refine((s) => !Number.isNaN(Date.parse(s)), 'Data/ora non valida'),
  customerName: z.string().min(2).max(80),
  customerEmail: z.union([z.string().email().max(120), z.literal('')]).optional(),
  customerPhone: z.string().regex(phoneRegex, 'Telefono non valido').max(30),
  dogName: z.string().max(50).optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
  coatChoice: z.enum(['SHORT', 'LONG']).optional(),
  forceOverlap: z.boolean().default(false),
});

export type AdminBookingInput = z.infer<typeof AdminBookingInputSchema>;

export const BookingEditSchema = z.object({
  bookingId: z.string().min(1),
  startsAt: z
    .string()
    .min(1)
    .refine((s) => !Number.isNaN(Date.parse(s)), 'Data/ora non valida'),
  notes: z.string().max(500).optional().or(z.literal('')),
  // Optional full-edit fields (back-compat: if omitted, booking keeps current value)
  customerName: z.string().min(2).max(80).optional(),
  customerEmail: z.union([z.string().email().max(120), z.literal('')]).optional(),
  customerPhone: z.string().regex(phoneRegex, 'Telefono non valido').max(30).optional(),
  dogName: z.string().max(50).optional().or(z.literal('')),
  animalType: AnimalTypeEnum.optional(),
  dogBreed: z.string().max(80).optional().or(z.literal('')),
  sizeOptionId: z.string().min(1).optional().or(z.literal('')),
  coatChoice: z.enum(['SHORT', 'LONG']).optional(),
  serviceId: z.string().min(1).optional(),
  addonServiceIds: z.array(z.string().min(1)).max(20).optional(),
});

export const OpeningHoursSchema = z.object({
  hours: z.array(
    z.object({
      dayOfWeek: z.coerce.number().int().min(0).max(6),
      openMinute: z.coerce.number().int().min(0).max(24 * 60),
      closeMinute: z.coerce.number().int().min(0).max(24 * 60),
      active: z.boolean().default(true),
    }).refine((d) => !d.active || d.closeMinute > d.openMinute, {
      message: "L'orario di chiusura deve essere dopo l'apertura",
      path: ['closeMinute'],
    }),
  ).length(7),
});

export const ExtraAdminSchema = z.object({
  name: z.string().min(2).max(80),
  priceCents: z.coerce.number().int().min(0).max(100000),
  dogOnly: z.boolean().default(false),
  active: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export const BreedSizeEnum = z.enum(['SMALL', 'MEDIUM', 'LARGE']);
export const CoatTypeEnum = z.enum(['SHORT', 'LONG', 'MIXED']);

export const BreedAdminSchema = z
  .object({
    name: z.string().min(2).max(80),
    animalType: AnimalTypeEnum,
    size: BreedSizeEnum.nullable().optional(),
    coatType: CoatTypeEnum.nullable().optional(),
    priceMin: z.coerce.number().int().min(0).max(1000),
    priceMax: z.coerce.number().int().min(0).max(1000),
    priceTrim: z.coerce.number().int().min(0).max(1000).nullable().optional(),
    priceTrimLong: z.coerce.number().int().min(0).max(1000).nullable().optional(),
    priceTouchUp: z.coerce.number().int().min(0).max(1000).nullable().optional(),
    active: z.boolean().default(true),
    sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  })
  .refine((d) => d.priceMax >= d.priceMin, {
    message: 'Il prezzo massimo deve essere ≥ del minimo',
    path: ['priceMax'],
  });
// Note: taglia (size) ora opzionale anche per cani — supportata tramite BreedSizeOption (taglia "Variabile").
