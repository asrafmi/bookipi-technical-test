-- KEYS[1] = stock key (integer counter)
-- KEYS[2] = buyers key (set of identifiers)
-- ARGV[1] = identifier
-- ARGV[2] = now (unix ms)
-- ARGV[3] = startsAt (unix ms)
-- ARGV[4] = endsAt (unix ms)
--
-- Returns one of: "OK" | "SALE_NOT_STARTED" | "SALE_ENDED" | "SOLD_OUT" | "ALREADY_PURCHASED"

local stockKey = KEYS[1]
local buyersKey = KEYS[2]
local identifier = ARGV[1]
local now = tonumber(ARGV[2])
local startsAt = tonumber(ARGV[3])
local endsAt = tonumber(ARGV[4])

if now < startsAt then
  return "SALE_NOT_STARTED"
end

if now > endsAt then
  return "SALE_ENDED"
end

if redis.call("SISMEMBER", buyersKey, identifier) == 1 then
  return "ALREADY_PURCHASED"
end

local stock = tonumber(redis.call("GET", stockKey))
if stock == nil or stock <= 0 then
  return "SOLD_OUT"
end

redis.call("DECR", stockKey)
redis.call("SADD", buyersKey, identifier)

return "OK"