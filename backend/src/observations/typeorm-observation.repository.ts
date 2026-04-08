import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Observation, ObservationRepository } from '../common/interfaces/observation.repository';
import { ObservationEntity } from './observation.entity';

@Injectable()
export class TypeOrmObservationRepository implements ObservationRepository {
  constructor(
    @InjectRepository(ObservationEntity)
    private readonly repo: Repository<ObservationEntity>,
  ) {}

  async findById(id: string): Promise<Observation | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toObservation(row) : null;
  }

  async findByUserId(userId: string): Promise<Observation[]> {
    const rows = await this.repo.find({
      where: { userId },
      order: { observedAt: 'DESC' },
    });
    return rows.map((r) => this.toObservation(r));
  }

  async save(data: Omit<Observation, 'id'>): Promise<Observation> {
    const entity = this.repo.create({
      userId: data.userId,
      spotId: data.spotId,
      starIndexVal: data.starIndexVal,
      weatherSnapshot: data.weatherSnapshot,
      result: data.result,
      observedAt: data.observedAt ?? new Date(),
    });
    const row = await this.repo.save(entity);
    return this.toObservation(row);
  }

  async deleteById(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  private toObservation(row: ObservationEntity): Observation {
    return {
      id: row.id,
      userId: row.userId,
      spotId: row.spotId,
      starIndexVal: row.starIndexVal,
      weatherSnapshot: row.weatherSnapshot,
      result: row.result,
      observedAt: row.observedAt,
    };
  }
}
