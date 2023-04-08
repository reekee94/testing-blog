import { NestFactory } from '@nestjs/core';
import { ApplicationModule } from './app.module';
import { PORT } from './config';


async function bootstrap() {
  const appOptions = {cors: true};
  const app = await NestFactory.create(ApplicationModule, appOptions);
  app.setGlobalPrefix('api');

  await app.listen(PORT || 3000, () => {
    console.log(`...listening port: ${PORT || 3000}`)
  });
}
bootstrap();