DROP INDEX "User_single_row_idx";

-- Pengganti: tetap cuma boleh satu OWNER, admin bebas banyak
CREATE UNIQUE INDEX "User_single_owner_idx" ON "User" (role)
WHERE
    role = 'OWNER';