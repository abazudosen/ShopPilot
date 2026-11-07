# The episode checkpoint: it works when...
npm run seed --workspace=backend        # Seeded 201 products into PostgreSQL

curl -s http://localhost:3500/api/products | jq '.total'
# 201

curl -s 'http://localhost:3500/api/products?category=Laptops' | jq '.total'
# 36

curl -s 'http://localhost:3500/api/products?minPrice=banana' | jq '.message'
# ["minPrice must be a number string"]  <- a clean 400, not a crash
