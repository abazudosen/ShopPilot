import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductQueryDto } from './dto/product-query.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../prisma/client';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { HistoryService } from '../history/history.service';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly historyService: HistoryService,
  ) {}

  @Get()
  async findAll(@Query() query: ProductQueryDto) {
    return this.productsService.findAll(query);
  }

  @Get('categories')
  async getCategories() {
    return this.productsService.getCategories();
  }

  @Get('deals')
  async getDeals() {
    return this.productsService.getDeals();
  }

  @Get('recommendations')
  @UseGuards(OptionalJwtAuthGuard)
  async recommendations(@CurrentUser('id') userId?: string) {
    const profile = await this.historyService.getProfile(userId);
    const products = await this.productsService.recommendForProfile(profile, 8);
    return {
      personalized: profile.hasHistory,
      products: products.map((p) => ({
        ...p,
        reason: this.productsService.recommendationReason(p, profile),
      })),
    };
  }

  @Get('seller')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER)
  async findBySeller(@CurrentUser('id') sellerId: string) {
    return this.productsService.findBySellerId(sellerId);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const product = await this.productsService.findById(id);
    if (!product) {
      throw new NotFoundException(`Product with id "${id}" not found`);
    }
    return product;
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER)
  async create(
    @Body() dto: CreateProductDto,
    @CurrentUser('id') sellerId: string,
  ) {
    return this.productsService.create(dto, sellerId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser('id') sellerId: string,
  ) {
    return this.productsService.update(id, dto, sellerId);
  }
}
