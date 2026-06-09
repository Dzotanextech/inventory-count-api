import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? true,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Inventory Count Management API')
    .setDescription(
      'Enterprise-grade inventory counting system for warehouses. ' +
        'Supports full physical count lifecycle: create → start → count → submit → approve.',
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' })
    .addTag('auth', 'Login, refresh token, logout')
    .addTag('users', 'User management (SUPER_ADMIN)')
    .addTag('roles', 'Role management (SUPER_ADMIN)')
    .addTag('warehouses', 'Warehouse CRUD')
    .addTag('zones', 'Zone CRUD')
    .addTag('racks', 'Rack CRUD + barcode lookup')
    .addTag('categories', 'Product category CRUD')
    .addTag('products', 'Product CRUD + barcode lookup')
    .addTag('batches', 'Batch / lot number management')
    .addTag('inventory-locations', 'Current stock levels per location')
    .addTag('inventory-counts', 'Count lifecycle management')
    .addTag('inventory-count-items', 'Physical count recording + barcode scan')
    .addTag('approvals', 'Approval history (read-only)')
    .addTag('audit', 'Audit trail (SUPER_ADMIN)')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true, tagsSorter: 'alpha' },
    customSiteTitle: 'Inventory Count API',
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`Application running on http://localhost:${port}/api/v1`);
  logger.log(`Swagger docs: http://localhost:${port}/docs`);
}

bootstrap();
