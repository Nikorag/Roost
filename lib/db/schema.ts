import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  boolean,
  pgEnum,
  primaryKey,
  jsonb,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/* ---------- enums ---------- */

export const projectStatus = pgEnum("project_status", [
  "idea",
  "planning",
  "in_progress",
  "blocked",
  "completed",
  "archived",
]);

export const taskStatus = pgEnum("task_status", [
  "todo",
  "in_progress",
  "blocked",
  "done",
]);

export const actionStatus = pgEnum("action_status", [
  "open",
  "doing",
  "done",
  "cancelled",
]);

export const eventLinkKind = pgEnum("event_link_kind", [
  "personnel",
  "contractor",
  "material",
]);

export const imageKind = pgEnum("image_kind", ["before", "progress", "after", "other"]);

export const mealSource = pgEnum("meal_source", ["mealie", "takeaway", "adhoc"]);
export const mealSlot = pgEnum("meal_slot", ["breakfast", "lunch", "dinner"]);
export const pantryUnit = pgEnum("pantry_unit", [
  "g",
  "kg",
  "ml",
  "l",
  "pcs",
  "tbsp",
  "tsp",
  "cup",
  "other",
]);

/* ---------- core ---------- */

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  oidcSub: text("oidc_sub").unique(),
  icsToken: text("ics_token").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    status: projectStatus("status").default("planning").notNull(),
    color: text("color").default("mint").notNull(),
    budgetCents: integer("budget_cents"),
    startDate: timestamp("start_date", { withTimezone: true }),
    targetDate: timestamp("target_date", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ statusIdx: index("projects_status_idx").on(t.status) }),
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: taskStatus("status").default("todo").notNull(),
    position: integer("position").default(0).notNull(),
    assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
    dueDate: timestamp("due_date", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    projectIdx: index("tasks_project_idx").on(t.projectId),
    assigneeIdx: index("tasks_assignee_idx").on(t.assigneeId),
  }),
);

export const contractors = pgTable("contractors", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  trade: text("trade"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  notes: text("notes"),
  rating: integer("rating"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const personnel = pgTable("personnel", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  relation: text("relation"),
  phone: text("phone"),
  email: text("email"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tools = pgTable("tools", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  ownedBy: text("owned_by"),
  location: text("location"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ---------- project ⇄ directory join tables ---------- */

export const projectContractors = pgTable(
  "project_contractors",
  {
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    contractorId: uuid("contractor_id").notNull().references(() => contractors.id, { onDelete: "cascade" }),
    role: text("role"),
  },
  (t) => ({ pk: primaryKey({ columns: [t.projectId, t.contractorId] }) }),
);

export const projectPersonnel = pgTable(
  "project_personnel",
  {
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    personnelId: uuid("personnel_id").notNull().references(() => personnel.id, { onDelete: "cascade" }),
    role: text("role"),
  },
  (t) => ({ pk: primaryKey({ columns: [t.projectId, t.personnelId] }) }),
);

export const projectTools = pgTable(
  "project_tools",
  {
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    toolId: uuid("tool_id").notNull().references(() => tools.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.projectId, t.toolId] }) }),
);

export const taskContractors = pgTable(
  "task_contractors",
  {
    taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    contractorId: uuid("contractor_id").notNull().references(() => contractors.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.taskId, t.contractorId] }) }),
);

export const taskPersonnel = pgTable(
  "task_personnel",
  {
    taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    personnelId: uuid("personnel_id").notNull().references(() => personnel.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.taskId, t.personnelId] }) }),
);

export const actionContractors = pgTable(
  "action_contractors",
  {
    actionId: uuid("action_id").notNull().references(() => actions.id, { onDelete: "cascade" }),
    contractorId: uuid("contractor_id").notNull().references(() => contractors.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.actionId, t.contractorId] }) }),
);

export const actionPersonnel = pgTable(
  "action_personnel",
  {
    actionId: uuid("action_id").notNull().references(() => actions.id, { onDelete: "cascade" }),
    personnelId: uuid("personnel_id").notNull().references(() => personnel.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.actionId, t.personnelId] }) }),
);

/* ---------- materials ---------- */

export const materials = pgTable(
  "materials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    quantity: text("quantity"),
    notes: text("notes"),
    /** When true the user is choosing between options below. */
    isOpenChoice: boolean("is_open_choice").default(false).notNull(),
    chosenOptionId: uuid("chosen_option_id"),
    purchased: boolean("purchased").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ projectIdx: index("materials_project_idx").on(t.projectId) }),
);

export const materialOptions = pgTable(
  "material_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    materialId: uuid("material_id").notNull().references(() => materials.id, { onDelete: "cascade" }),
  /** Short label shown on chips, e.g. "Skimming Stone 2.5L" */
  label: text("label").notNull(),
  /** Where to buy from, e.g. "Wickes" */
  vendor: text("vendor"),
  /** Direct purchase URL */
  url: text("url"),
  priceCents: integer("price_cents"),
    /** Free-text description / notes */
    description: text("description"),
  },
  (t) => ({ materialIdx: index("material_options_material_idx").on(t.materialId) }),
);

/* ---------- money ---------- */

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    contractorId: uuid("contractor_id").references(() => contractors.id, { onDelete: "set null" }),
    vendor: text("vendor"),
    reference: text("reference"),
    totalCents: integer("total_cents").notNull(),
    issuedOn: timestamp("issued_on", { withTimezone: true }),
    paidOn: timestamp("paid_on", { withTimezone: true }),
    uploadId: uuid("upload_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ taskIdx: index("invoices_task_idx").on(t.taskId) }),
);

export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    contractorId: uuid("contractor_id").references(() => contractors.id, { onDelete: "set null" }),
    vendor: text("vendor"),
    totalCents: integer("total_cents").notNull(),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    accepted: boolean("accepted").default(false).notNull(),
    uploadId: uuid("upload_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ taskIdx: index("quotes_task_idx").on(t.taskId) }),
);

/* ---------- actions (assigned todos) ---------- */

export const actions = pgTable(
  "actions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: actionStatus("status").default("open").notNull(),
    assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
    dueDate: timestamp("due_date", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    projectIdx: index("actions_project_idx").on(t.projectId),
    assigneeIdx: index("actions_assignee_idx").on(t.assigneeId),
  }),
);

/* ---------- events + calendar ---------- */

export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    notes: text("notes"),
    /** Date the event starts. Always treated as all-day; no time component. */
    startsOn: timestamp("starts_on", { withTimezone: true }).notNull(),
    /** Length of the event in days (>=1). */
    durationDays: integer("duration_days").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ projectIdx: index("events_project_idx").on(t.projectId) }),
);

export const eventLinks = pgTable(
  "event_links",
  {
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    kind: eventLinkKind("kind").notNull(),
    /** Reference into personnel/contractors/materials by id; not FK-typed because polymorphic. */
    refId: uuid("ref_id").notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.eventId, t.kind, t.refId] }) }),
);

/* ---------- uploads ---------- */

export const uploads = pgTable(
  "uploads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
    bucket: text("bucket").notNull(),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type"),
    sizeBytes: integer("size_bytes"),
    originalName: text("original_name"),
    /** before / progress / after / other */
    kind: imageKind("kind").default("other").notNull(),
    /** Free-text caption */
    caption: text("caption"),
    /** When true, this image was AI-generated (e.g. predicted "after"). */
    aiGenerated: boolean("ai_generated").default(false).notNull(),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    projectIdx: index("uploads_project_idx").on(t.projectId),
    taskIdx: index("uploads_task_idx").on(t.taskId),
  }),
);

/* ---------- relations ---------- */

export const projectRelations = relations(projects, ({ many, one }) => ({
  tasks: many(tasks),
  actions: many(actions),
  events: many(events),
  materials: many(materials),
  contractors: many(projectContractors),
  personnel: many(projectPersonnel),
  tools: many(projectTools),
  uploads: many(uploads),
  creator: one(users, { fields: [projects.createdBy], references: [users.id] }),
}));

export const taskRelations = relations(tasks, ({ many, one }) => ({
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  invoices: many(invoices),
  quotes: many(quotes),
  contractors: many(taskContractors),
}));

export const materialRelations = relations(materials, ({ many }) => ({
  options: many(materialOptions),
}));

export const materialOptionRelations = relations(materialOptions, ({ one }) => ({
  material: one(materials, { fields: [materialOptions.materialId], references: [materials.id] }),
}));

export const eventRelations = relations(events, ({ many, one }) => ({
  project: one(projects, { fields: [events.projectId], references: [projects.id] }),
  links: many(eventLinks),
}));

/* ---------- AI prompt settings ---------- */

export const aiPromptSettings = pgTable("ai_prompt_settings", {
  key: text("key").primaryKey(),
  instructions: text("instructions").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Generic household-level key/value settings (calendar URLs, integrations, etc). */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ---------- meals ---------- */

export const takeawayMeals = pgTable("takeaway_meals", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  vendor: text("vendor"),
  notes: text("notes"),
  /** Single-glyph emoji used as the icon for this takeaway. AI-suggested at create. */
  emoji: text("emoji"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Light cache of Mealie recipe metadata so we don't refetch for list views. */
export const mealieRecipes = pgTable("mealie_recipes", {
  /** Mealie's own id (uuid or slug; we treat as opaque text). */
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  /** JSON cache of the last-known recipe payload — used to avoid re-fetching ingredients. */
  payload: jsonb("payload"),
  lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }).defaultNow().notNull(),
});

export const mealPlanEntries = pgTable(
  "meal_plan_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** All-day date (stored as timestamp, only the date portion is meaningful). */
    date: timestamp("date", { withTimezone: true }).notNull(),
    slot: mealSlot("slot").default("dinner").notNull(),
    source: mealSource("source").notNull(),
    mealieRecipeId: text("mealie_recipe_id"),
    takeawayMealId: uuid("takeaway_meal_id").references(() => takeawayMeals.id, {
      onDelete: "set null",
    }),
    /** Used when source = 'adhoc' (leftovers, freeform). */
    adhocName: text("adhoc_name"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    dateIdx: index("meal_plan_date_idx").on(t.date),
    slotIdx: index("meal_plan_slot_idx").on(t.slot),
  }),
);

export const pantryItems = pgTable(
  "pantry_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Normalized lowercase key used for de-duplication and shopping-list matching. */
    nameKey: text("name_key").notNull(),
    displayName: text("display_name").notNull(),
    quantity: numeric("quantity"),
    unit: pantryUnit("unit"),
    expiresOn: timestamp("expires_on", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ nameIdx: index("pantry_name_idx").on(t.nameKey) }),
);

export const mealHistory = pgTable(
  "meal_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eatenOn: timestamp("eaten_on", { withTimezone: true }).notNull(),
    source: mealSource("source").notNull(),
    mealieRecipeId: text("mealie_recipe_id"),
    takeawayMealId: uuid("takeaway_meal_id").references(() => takeawayMeals.id, {
      onDelete: "set null",
    }),
    adhocName: text("adhoc_name"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ eatenIdx: index("meal_history_eaten_idx").on(t.eatenOn) }),
);

export const shoppingLists = pgTable(
  "shopping_lists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Monday of the week the list covers. */
    weekStart: timestamp("week_start", { withTimezone: true }).notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => ({ weekIdx: index("shopping_list_week_idx").on(t.weekStart) }),
);

export const shoppingListItems = pgTable(
  "shopping_list_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shoppingListId: uuid("shopping_list_id")
      .notNull()
      .references(() => shoppingLists.id, { onDelete: "cascade" }),
    nameKey: text("name_key").notNull(),
    displayName: text("display_name").notNull(),
    quantity: numeric("quantity"),
    unit: pantryUnit("unit"),
    /** Mealie recipe IDs (and/or 'manual') that contributed to this line. */
    sources: jsonb("sources"),
    checked: boolean("checked").default(false).notNull(),
    manuallyAdded: boolean("manually_added").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ listIdx: index("shopping_list_items_list_idx").on(t.shoppingListId) }),
);

export const mealPlanRelations = relations(mealPlanEntries, ({ one }) => ({
  takeaway: one(takeawayMeals, {
    fields: [mealPlanEntries.takeawayMealId],
    references: [takeawayMeals.id],
  }),
}));

export const shoppingListRelations = relations(shoppingLists, ({ many }) => ({
  items: many(shoppingListItems),
}));

export const shoppingListItemRelations = relations(shoppingListItems, ({ one }) => ({
  list: one(shoppingLists, {
    fields: [shoppingListItems.shoppingListId],
    references: [shoppingLists.id],
  }),
}));
