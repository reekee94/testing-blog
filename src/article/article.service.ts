import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, getRepository, DeleteResult } from 'typeorm';
import { ArticleEntity } from './article.entity';
import { Comment } from './comment.entity';
import { UserEntity } from '../user/user.entity';
import { FollowsEntity } from '../profile/follows.entity';
import { CreateArticleDto } from './dto';

import {ArticleRO, ArticlesRO, CommentsRO} from './article.interface';
const slug = require('slug');

@Injectable()
export class ArticleService {
  constructor(
    @InjectRepository(ArticleEntity)
    private readonly articleRepository: Repository<ArticleEntity>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(FollowsEntity)
    private readonly followsRepository: Repository<FollowsEntity>
  ) {}

  async findAll(query, userId=null): Promise<ArticlesRO> {

    const qb = await getRepository(ArticleEntity)
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.author', 'author')
      // .leftJoinAndSelect("article.categories", "category");

    qb.where("1 = 1");

    if ('author' in query) {
      const author = await this.userRepository.findOne({username: query.author});
      qb.andWhere("article.author = :id", { id: author.id });
    }

    if ('favorited' in query) {
      console.log(query, 'FAVOURITED')
      const author = await this.userRepository.findOne({
        where: {username: query.favorited},
        relations: ['favorites'],
      });
      console.log(author, 'FAVOURITED')

      const ids = author.favorites?.map(el => el.id);
      console.log(ids, 'FAVOURITED IDSSSSSSSSSSS')

      qb.andWhere("article.id IN (:...ids)", { ids });
    }

    qb.orderBy('article.created', 'DESC');

    const articlesCount = await qb.getCount();

    if ('limit' in query) {
      qb.limit(query.limit);
    }

    if ('offset' in query) {
      qb.offset(query.offset);
    }

    const articles = await qb.getMany();

    if(userId) {
      const author = await this.userRepository.findOne({
        where: {id: userId},
        relations: ['favorites'],
      });
      
      const userFavIds = author.favorites?.map(el => el.id);
      
      articles.forEach((article) => {
        (userFavIds && userFavIds.includes(article.id)) ? article.favorited = true : article.favorited = false
      })
    }

    return {articles, articlesCount};
  }

  async findFeed(userId: number, query): Promise<ArticlesRO> {
    const _follows = await this.followsRepository.find( {followerId: userId});

    if (!(Array.isArray(_follows) && _follows.length > 0)) {
      return {articles: [], articlesCount: 0};
    }

    const ids = _follows.map(el => el.followingId);

    const qb = await getRepository(ArticleEntity)
      .createQueryBuilder('article')
      .where('article.author IN (:ids)', { ids });

    qb.orderBy('article.created', 'DESC');

    const articlesCount = await qb.getCount();

    if ('limit' in query) {
      qb.limit(query.limit);
    }

    if ('offset' in query) {
      qb.offset(query.offset);
    }

    const articles = await qb.getMany();

    return {articles, articlesCount};
  }

  async findOne(where): Promise<ArticleRO> {
    const article = await this.articleRepository.findOne(where);
    return {article};
  }

  async addComment(userId: number, slug: string, commentData: any): Promise<CommentsRO> {
    let article = await this.articleRepository.findOne({slug});
    const author = await this.userRepository.findOne({
      where: { id: userId },
    });

    const comment = new Comment();
    comment.body = commentData.body;
    comment.author = author

    article.comments.push(comment);

    await this.commentRepository.save(comment);
    await this.articleRepository.save(article);

    //@ts-ignore
    return {comment}
  }

  async deleteComment(slug: string, id: string): Promise<ArticleRO> {
    let article = await this.articleRepository.findOne({slug});

    const comment = await this.commentRepository.findOne(id);
    const deleteIndex = article.comments.findIndex(_comment => _comment.id === comment.id);

    if (deleteIndex >= 0) {
      const deleteComments = article.comments.splice(deleteIndex, 1);
      await this.commentRepository.delete(deleteComments[0].id);
      article =  await this.articleRepository.save(article);
      return {article};
    } else {
      return {article};
    }

  }

  async favorite(id: number, slug: string): Promise<ArticleRO> {
    let article = await this.articleRepository.findOne({slug});
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['favorites'],
    });


    const isNewFavorite = user.favorites.findIndex(_article => _article.id === article.id) < 0;
    if (isNewFavorite) {
      user.favorites.push(article)
      article.favoriteCount++;

      await this.userRepository.save(user);
      article = await this.articleRepository.save(article);
      article.favorited = true;
    }

    return {article};
  }

  async unFavorite(id: number, slug: string): Promise<ArticleRO> {
    let article = await this.articleRepository.findOne({slug});
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['favorites'],
    });


    const deleteIndex = user.favorites.findIndex(_article => _article.id === article.id);

    if (deleteIndex >= 0) {

      user.favorites.splice(deleteIndex, 1);
      article.favoriteCount--;

      await this.userRepository.save(user);
      article = await this.articleRepository.save(article);
      article.favorited = false
    }

    return {article};
  }

  async findComments(slug: string): Promise<CommentsRO> {
    const article = await this.articleRepository.findOne({slug});
    
    return {comments: article.comments};
  }

  async create(userId: number, articleData: CreateArticleDto): Promise<ArticleEntity> {
    
    let article = new ArticleEntity();
    article.title = articleData.title;
    article.description = articleData.description;
    article.slug = this.slugify(articleData.title);
    article.comments = [];
    
    const newArticle = await this.articleRepository.save(article);
    
    const author = await this.userRepository.findOne({ where: { id: userId }, relations: ['articles'] });
  
    author.articles.push(article);

    await this.userRepository.save(author);

    return newArticle;

  }

  async update(slug: string, articleData: any): Promise<ArticleRO> {
    let toUpdate = await this.articleRepository.findOne({ slug: slug});
    let updated = Object.assign(toUpdate, articleData);
    const article = await this.articleRepository.save(updated);
    return {article};
  }

  async delete(slug: string): Promise<DeleteResult> {
    return await this.articleRepository.delete({ slug: slug});
  }

  slugify(title: string) {
    return slug(title, {lower: true}) + '-' + (Math.random() * Math.pow(36, 6) | 0).toString(36)
  }
}
