import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { Photo, PhotoRepository } from '../common/interfaces/photo.repository';
import { PhotoEntity } from './photo.entity';

@Injectable()
export class TypeOrmPhotoRepository implements PhotoRepository {
  constructor(
    @InjectRepository(PhotoEntity)
    private readonly repo: Repository<PhotoEntity>,
  ) {}

  async findByObservationIds(observationIds: string[]): Promise<Photo[]> {
    if (observationIds.length === 0) return [];
    const rows = await this.repo.find({
      where: { observationId: In(observationIds) },
      order: { createdAt: 'ASC' },
    });
    return rows.map((r) => this.toPhoto(r));
  }

  async save(data: Omit<Photo, 'id'>): Promise<Photo> {
    const entity = this.repo.create({
      observationId: data.observationId,
      imageUrl: data.imageUrl,
      caption: data.caption,
      takenAt: data.takenAt,
    });
    const row = await this.repo.save(entity);
    return this.toPhoto(row);
  }

  async deleteByObservationId(observationId: string): Promise<void> {
    await this.repo.delete({ observationId });
  }

  private toPhoto(row: PhotoEntity): Photo {
    return {
      id: row.id,
      observationId: row.observationId,
      imageUrl: row.imageUrl,
      caption: row.caption,
      takenAt: row.takenAt,
    };
  }
}
