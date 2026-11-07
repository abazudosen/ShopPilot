import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { SearchService } from './search/search.service';
import { EmbeddingService } from './search/embedding.service';
import catalog from './catalog.json';

interface SeedProduct {
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  rating: number;
  inStock: boolean;
  features: string[];
}

const SEED_PRODUCTS: SeedProduct[] = catalog;
async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const prisma = app.get(PrismaService);

    console.log('Clearing existing data...');
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.product.deleteMany();
    await prisma.user.deleteMany();

    const searchService = app.get(SearchService);
    const embeddingService = app.get(EmbeddingService);

    await searchService.deleteIndex();
    await searchService.createIndexIfNotExists();
    console.log('Creating demo users...');
    const sellerPassword = await bcrypt.hash('admin123', 10);
    const buyerPassword = await bcrypt.hash('admin123', 10);

    const seller = await prisma.user.create({
      data: {
        email: 'seller@ai-ecommerce.com',
        name: 'Demo Seller',
        password: sellerPassword,
        role: 'SELLER',
      },
    });
    console.log(`  Seller: ${seller.email} (id: ${seller.id})`);

    const buyer = await prisma.user.create({
      data: {
        email: 'buyer@ai-ecommerce.com',
        name: 'Demo Buyer',
        password: buyerPassword,
        role: 'BUYER',
      },
    });
    console.log(`  Buyer: ${buyer.email} (id: ${buyer.id})`);
    console.log(`Seeding ${SEED_PRODUCTS.length} products...`);
    const products = await Promise.all(
      SEED_PRODUCTS.map((p) =>
        prisma.product.create({
          data: {
            name: p.name,
            description: p.description,
            price: p.price,
            category: p.category,
            image: p.image,
            rating: p.rating,
            inStock: p.inStock,
            features: p.features,
            sellerId: seller.id,
          },
        }),
      ),
    );
    console.log(`Seeded ${products.length} products into PostgreSQL`);

    let allEmbeddings: number[][] = [];
    if (embeddingService.isConfigured()) {
      try {
        console.log('Generating embeddings for all products...');
        const BATCH_SIZE = 50;
        for (let i = 0; i < SEED_PRODUCTS.length; i += BATCH_SIZE) {
          const batch = SEED_PRODUCTS.slice(i, i + BATCH_SIZE);
          const texts = batch.map((p) => embeddingService.buildEmbeddingText(p));
          const embeddings = await embeddingService.generateEmbeddings(texts);
          allEmbeddings.push(...embeddings);
          console.log(`  Embedded batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(SEED_PRODUCTS.length / BATCH_SIZE)} (${allEmbeddings.length}/${SEED_PRODUCTS.length})`);
        }
      } catch (error) {
        allEmbeddings = [];
        console.warn(
          `Could not generate embeddings; continuing with keyword search. ${String(error)}`,
        );
      }
    } else {
      console.log('OPENAI_API_KEY is not configured; skipping embeddings.');
    }

    const productsWithEmbeddings = products.map((p, i) => ({
      id: p.id, name: p.name, description: p.description, category: p.category,
      features: p.features, price: Number(p.price), rating: Number(p.rating),
      inStock: p.inStock, image: p.image,
      ...(allEmbeddings.length ? { embedding: allEmbeddings[i] } : {}),
    }));

    await searchService.bulkIndexProducts(productsWithEmbeddings);
    console.log(
      `Indexed ${products.length} products in OpenSearch${allEmbeddings.length ? ' with embeddings' : ' for keyword search'}`,
    );

    const categories = [...new Set(SEED_PRODUCTS.map(p => p.category))];
    console.log('\n--- Seed completed successfully! ---');
    console.log(`Total products: ${products.length}`);
    for (const cat of categories) {
      const count = SEED_PRODUCTS.filter(p => p.category === cat).length;
      const prices = SEED_PRODUCTS.filter(p => p.category === cat).map(p => p.price);
      console.log(`  ${cat}: ${count} ($${Math.min(...prices)} - $${Math.max(...prices)})`);
    }
    console.log(`  Out of stock: ${SEED_PRODUCTS.filter(p => !p.inStock).length}`);
    console.log('\nDemo credentials:');
    console.log('  Seller: seller@ai-ecommerce.com / admin123');
    console.log('  Buyer:  buyer@ai-ecommerce.com / admin123');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

seed();
