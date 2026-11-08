# Database Module

This module handles database operations using Kysely, a type-safe SQL query builder for TypeScript.

## Migration from Raw SQL to Kysely

The database module is transitioning from raw SQL queries to Kysely for better type safety and developer experience. The migration is being done gradually to minimize disruption.

### Key Features

- **Type Safety**: Full TypeScript support with auto-generated types
- **Query Building**: Fluent API for building complex queries
- **SQL Injection Protection**: Automatic protection against SQL injection
- **Transaction Support**: First-class support for database transactions
- **Automatic Type Generation**: Types are generated from your database schema

### Using Kysely

```typescript
import { db } from "@/database";
import type { Row, InsertRow, UpdateRow } from "@/database/types";

// Select with type safety
const user: Row<"users"> = await db
    .selectFrom("users")
    .selectAll()
    .where("id", "=", userId)
    .executeTakeFirst();

// Insert with type checking
const newUser: InsertRow<"users"> = {
    name: "John",
    email: "john@example.com",
};
await db.insertInto("users").values(newUser).execute();

// Update with autocomplete
const updates: UpdateRow<"users"> = {
    name: "John Doe",
};
await db.updateTable("users").set(updates).where("id", "=", userId).execute();

// Transactions
await db.transaction().execute(async (trx) => {
    const user = await trx
        .insertInto("users")
        .values(newUser)
        .returning("id")
        .executeTakeFirst();

    await trx
        .insertInto("profiles")
        .values({
            userId: user.id,
            bio: "Hello!",
        })
        .execute();
});
```

### Column Names Are camelCase (Table Names Are Not)

`db` has Kysely's `CamelCasePlugin` enabled (see `database/index.ts`), and
`types.ts` is generated with **camelCase column names** by default
(`DB_TYPES_CASE=camel` in `.env` — set it to `snake` to generate the real
column names instead). **Table names are never affected either way** — they
always match the real DB table names, so `selectFrom`/`insertInto`/joins
reference tables exactly as today.

This means for a column like `orders.tracking_token`, you write:

```typescript
const orderRow = await db
    .selectFrom("orders")
    .where("orders.trackingToken", "=", trackingToken) // camelCase column
    .selectAll()
    .executeTakeFirst();

return orderRow ?? null; // orderRow.trackingToken — correctly typed, no wrapping needed
```

TypeScript enforces this: autocomplete only offers `trackingToken`, and the
plugin sends the real `tracking_token` to Postgres. No wrapper, no cast,
no `camelKeys()` — the type and the runtime value have always matched, for
every query, since `types.ts` is generated to describe reality.

If you'd rather work with real snake_case column names, set
`DB_TYPES_CASE=snake` in `.env` and regenerate types — everything above still
applies, just with the original column names instead.

### Type Generation

Types are automatically generated after each migration. The types are stored in `types.ts` and reflect your current database schema.

To manually regenerate types:

```bash
npx ts-node scripts/generate-db-types.ts
```

### Common Patterns

#### Select Queries

```typescript
// Select all
const users = await db.selectFrom("users").selectAll().execute();

// Select specific columns
const names = await db.selectFrom("users").select(["id", "name"]).execute();

// Joins
const userProfiles = await db
    .selectFrom("users")
    .innerJoin("profiles", "users.id", "profiles.userId")
    .select(["users.name", "profiles.bio"])
    .execute();

// Where conditions
const activeUsers = await db
    .selectFrom("users")
    .selectAll()
    .where("status", "=", "active")
    .execute();

// Complex conditions
const searchUsers = await db
    .selectFrom("users")
    .selectAll()
    .where((eb) =>
        eb.or([eb("name", "like", "%John%"), eb("email", "like", "%john%")]),
    )
    .execute();
```

#### Insert Queries

```typescript
// Single insert
await db
    .insertInto("users")
    .values({
        name: "John",
        email: "john@example.com",
    })
    .execute();

// Bulk insert
await db
    .insertInto("users")
    .values([
        { name: "John", email: "john@example.com" },
        { name: "Jane", email: "jane@example.com" },
    ])
    .execute();

// Insert with returning
const [user] = await db
    .insertInto("users")
    .values({
        name: "John",
        email: "john@example.com",
    })
    .returning(["id", "createdAt"])
    .execute();
```

#### Update Queries

```typescript
// Simple update
await db
    .updateTable("users")
    .set({ name: "John Doe" })
    .where("id", "=", userId)
    .execute();

// Conditional update
await db
    .updateTable("users")
    .set({ status: "inactive" })
    .where("lastLogin", "<", someDate)
    .execute();

// Update with returning
const [updated] = await db
    .updateTable("users")
    .set({ name: "John Doe" })
    .where("id", "=", userId)
    .returning(["id", "name", "updatedAt"])
    .execute();
```

#### Delete Queries

```typescript
// Simple delete
await db.deleteFrom("users").where("id", "=", userId).execute();

// Conditional delete
await db.deleteFrom("users").where("status", "=", "inactive").execute();
```

### Best Practices

1. **Always use types**:

```typescript
import type { Row, InsertRow, UpdateRow } from '@/database/types';

const user: Row<'users'> = // ...
const newUser: InsertRow<'users'> = // ...
const updates: UpdateRow<'users'> = // ...
```

2. **Use transactions for related operations**:

```typescript
await db.transaction().execute(async (trx) => {
    // Use trx instead of db
});
```

3. **Take advantage of the query builder**:

```typescript
// Instead of raw SQL:
// SELECT * FROM users WHERE status = 'active' ORDER BY created_at DESC LIMIT 10

await db
    .selectFrom("users")
    .selectAll()
    .where("status", "=", "active")
    .orderBy("createdAt", "desc")
    .limit(10)
    .execute();
```

4. **Use type-safe joins**:

```typescript
await db
    .selectFrom("users")
    .innerJoin("profiles", "users.id", "profiles.userId")
    .select(["users.name", "profiles.bio"])
    .execute();
```

### Troubleshooting

1. **Types are not updating**: Run the type generation script manually:

```bash
npx ts-node scripts/generate-db-types.ts
```

2. **Type errors**: Make sure your database schema matches your types. If not, run migrations and regenerate types.

3. **Query not working**: Use the query builder's debug method to see the generated SQL:

```typescript
console.log(
    db.selectFrom("users").selectAll().where("id", "=", userId).compile(),
);
```
